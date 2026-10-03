import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { ManualRefundService } from '@/backend/payments/manualRefundService'
import { AdminAuditService } from '@/backend/admin/admin-audit.service'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { resolveUserEmail } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'

const EntitlementSchema = z.object({
  trigger_type: z.literal('cancellation_request_entitlement'),
  cancellation_request_id: z.string().uuid(),
  destination_name: z.string().optional(),
  destination_contact_number: z.string().optional(),
  /** Optional capped amount (e.g. from a BA cancellation proposal). */
  amount: z.number().positive().optional(),
})

const OverrideSchema = z.object({
  trigger_type: z.literal('ba_override'),
  amount: z.number().positive(),
  justification_note: z.string().min(1),
  destination_name: z.string().min(1),
  destination_contact_number: z.string().min(1),
})

const BodySchema = z.discriminatedUnion('trigger_type', [EntitlementSchema, OverrideSchema])

function mapErrorToStatus(message: string): { status: number; text: string } {
  switch (message) {
    case 'amount_exceeds_total': return { status: 400, text: 'Refund amount cannot exceed the total amount paid' }
    case 'already_refunded': return { status: 409, text: 'This payment has already been refunded' }
    case 'not_refundable': return { status: 400, text: 'Only a completed payment can be refunded' }
    case 'no_refund_owed': return { status: 400, text: 'No refund is currently owed for this booking' }
    case 'cancellation_request_not_found': return { status: 404, text: 'Cancellation request not found' }
    case 'cancellation_not_approved': return { status: 400, text: 'This cancellation request has not been approved' }
    case 'payment_not_found': return { status: 404, text: 'Payment not found' }
    default: return { status: 500, text: message }
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { id: rawId } = await params
  const idCheck = parseUuidParam(rawId, 'payment id')
  if (!idCheck.ok) return idCheck.response
  const paymentId = idCheck.value

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return apiError(400, parsed.error.issues.map(i => i.message).join('; '))

  const supabase = createAdminClient()
  let resolvedPaymentId = paymentId

  try {
    if (parsed.data.trigger_type === 'cancellation_request_entitlement') {
      const result = await ManualRefundService.confirmEntitlement({
        cancellationRequestId: parsed.data.cancellation_request_id,
        destinationName: parsed.data.destination_name,
        destinationContactNumber: parsed.data.destination_contact_number,
        recordedBy: user.id,
        amount: parsed.data.amount,
      })
      resolvedPaymentId = result.paymentId

      await AdminAuditService.log({
        actorId: user.id,
        action: 'payment_refund_entitlement_confirmed',
        targetType: 'payment',
        targetId: result.paymentId,
        details: { cancellationRequestId: parsed.data.cancellation_request_id, refundAmount: result.amount },
      })
    } else {
      await ManualRefundService.override({
        paymentId,
        amount: parsed.data.amount,
        justificationNote: parsed.data.justification_note,
        destinationName: parsed.data.destination_name,
        destinationContactNumber: parsed.data.destination_contact_number,
        recordedBy: user.id,
      })

      await AdminAuditService.log({
        actorId: user.id,
        action: 'payment_refund_override',
        targetType: 'payment',
        targetId: paymentId,
        details: {
          justificationNote: parsed.data.justification_note,
          refundAmount: parsed.data.amount,
          destinationName: parsed.data.destination_name,
        },
      })
    }
  } catch (err) {
    const message = getErrorMessage(err)
    const { status, text } = mapErrorToStatus(message)
    return apiError(status, text)
  }

  // Post-commit: notify BA to upload proof
  try {
    const { data: refundRow } = await supabase
      .from('payment_refunds')
      .select('amount, destination_name, booking:bookings!payment_refunds_booking_id_fkey(booking_reference)')
      .eq('payment_id', resolvedPaymentId)
      .single()

    const bookingRef = (refundRow as any)?.booking?.booking_reference ?? ''
    const amountLabel = refundRow ? `₱${Number((refundRow as any).amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : ''

    // Notify BA that proof needs to be uploaded
    const { sendNotificationToRoles } = await import('@/backend/booking/autoDecisionRouter')
    void sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'Refund Created — Upload Proof',
      message: `A refund of ${amountLabel} for booking ${bookingRef} has been created. Upload payment proof in Payment Management.`,
      type: 'info',
      priority: 'high',
      source_type: 'payment',
      source_id: resolvedPaymentId,
    })
  } catch (err) {
    console.error('[refunds] post-refund notification failed:', err)
  }

  return NextResponse.json({ success: true })
}
