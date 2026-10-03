import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { resolveUserEmail } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { bookerQrProofRejectedEmail } from '@/backend/notifications/emailTemplates'

const BodySchema = z.object({ reason: z.string().min(1) })

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
  if (!parsed.success) return apiError(400, 'reason is required')

  const supabase = createAdminClient()
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, payment_status, user_id, booking:bookings!payments_booking_id_fkey(booking_reference)')
    .eq('id', paymentId)
    .single()
  if (paymentError || !payment) return apiError(404, 'Payment not found')
  if (payment.payment_status !== 'pending_review') return apiError(400, `Cannot reject a payment in "${payment.payment_status}" status`)

  const { error: updateError } = await supabase.from('payments').update({
    payment_status: 'failed', qr_review_notes: parsed.data.reason,
    qr_reviewed_by: user.id, qr_reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', paymentId)
  if (updateError) return apiError(500, 'Failed to reject payment')

  // The rejection itself already committed above — a failure here must never look
  // like the rejection failed, so it's logged, not thrown.
  try {
    await sendNotification(supabase, {
      user_id: payment.user_id, title: 'Payment Proof Rejected',
      message: `Your payment proof was rejected: ${parsed.data.reason}. Please resubmit.`,
      type: 'warning', source_type: 'payment', source_id: paymentId, priority: 'high',
    })

    const bookingRef = (payment as any).booking?.booking_reference ?? paymentId
    const { emailTo, name } = await resolveUserEmail(supabase, payment.user_id)
    if (emailTo) {
      const { subject, htmlBody } = bookerQrProofRejectedEmail({
        userName: name ?? 'there',
        bookingRef,
        reason: parsed.data.reason,
      })
      await sendBrevoEmail({ to: emailTo, subject, htmlBody }).catch(err =>
        console.error('[qr-reject] Failed to email booker:', err)
      )
    }
  } catch (err) {
    console.error('[qr-reject] post-reject notification/email failed:', err)
  }

  return NextResponse.json({ success: true })
}
