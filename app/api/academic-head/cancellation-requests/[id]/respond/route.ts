import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { getBuildingAdminEmails } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { buildingAdminRefundOwedEmail } from '@/backend/notifications/emailTemplates'

const idSchema = z.uuid()

const BodySchema = z.object({
  action: z.enum(['approve_no_strike', 'approve_with_strike', 'reject']),
  review_notes: z.string().max(1000).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const hasRole = user.roles?.some((r: { name: string }) => r.name === 'academic_head')
  if (!hasRole) {
    return NextResponse.json({ error: 'Forbidden: academic_head role required' }, { status: 403 })
  }

  const { id: rawId } = await params
  const idCheck = idSchema.safeParse(rawId)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid request id' }, { status: 400 })
  }
  const requestId = idCheck.data

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed' }, { status: 400 })
  }

  const { action, review_notes } = parsed.data
  const supabase = createAdminClient()

  try {
    // Load the cancellation request
    const { data: cancelRequest, error: fetchError } = await supabase
      .from('cancellation_requests')
      .select('id, booking_id, user_id, status, reason, original_status, refund_window_met, refund_destination_name')
      .eq('id', requestId)
      .single()

    if (fetchError || !cancelRequest) {
      return NextResponse.json({ error: 'Cancellation request not found' }, { status: 404 })
    }

    if (cancelRequest.refund_destination_name) {
      return NextResponse.json({ error: 'Paid booking cancellations must be handled by Building Admin' }, { status: 403 })
    }

    if (cancelRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot respond to request with status: ${cancelRequest.status}` },
        { status: 400 }
      )
    }

    // Load booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, booking_reference, current_status, requires_payment, booking_type')
      .eq('id', cancelRequest.booking_id)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Associated booking not found' }, { status: 404 })
    }

    const isPaidBooking = booking.requires_payment || ['internal_paid', 'external_paid'].includes((booking as any).booking_type)
    if (isPaidBooking || cancelRequest.refund_destination_name) {
      return NextResponse.json({ error: 'Paid booking cancellations must be handled by Building Admin' }, { status: 403 })
    }

    // Update cancellation request
    const newRequestStatus = action === 'approve_no_strike' ? 'approved_no_strike'
      : action === 'approve_with_strike' ? 'approved_with_strike'
      : 'rejected'

    await supabase
      .from('cancellation_requests')
      .update({
        status: newRequestStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: review_notes ?? null,
      })
      .eq('id', requestId)

    if (action === 'reject') {
      // Revert booking to original status
      await supabase.rpc('update_booking_status', {
        p_booking_id: cancelRequest.booking_id,
        p_new_status: cancelRequest.original_status,
        p_changed_by_user_id: user.id,
        p_changed_by_ai: false,
        p_reason: `Cancellation request rejected: ${review_notes ?? 'No reason provided'}`,
        p_metadata: { cancellation_request_id: requestId, action: 'reject' },
      })

      await sendNotification(supabase, {
        user_id: cancelRequest.user_id,
        title: 'Cancellation Request Rejected',
        message: `Your cancellation request for booking ${booking.booking_reference} has been rejected. The booking remains active.`,
        type: 'warning',
        source_type: 'cancellation_request',
        source_id: requestId,
        priority: 'normal',
      })

      return NextResponse.json({ success: true, action: 'rejected' })
    }

    // Approve — cancel the booking
    await supabase.rpc('update_booking_status', {
      p_booking_id: cancelRequest.booking_id,
      p_new_status: 'cancelled',
      p_changed_by_user_id: user.id,
      p_changed_by_ai: false,
      p_reason: `Cancellation approved by Academic Head: ${cancelRequest.reason}`,
      p_metadata: { cancellation_request_id: requestId, action, strike_waived: action === 'approve_no_strike' },
    })

    // Stamp cancellation type
    await supabase
      .from('bookings')
      .update({ cancellation_type: 'cancellation_approved', backend_cancellation_reason: cancelRequest.reason })
      .eq('id', cancelRequest.booking_id)

    // Void any pending payment for pre-payment bookings
    if (cancelRequest.original_status === 'pending_user_response') {
      await supabase
        .from('payments')
        .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('booking_id', cancelRequest.booking_id)
        .in('payment_status', ['pending', 'pending_review'])
    }

    // Payment-overhaul hook: refund-eligible paid booking → mark refund owed, notify Building Admin.
    // Note: 'refund_requested' is a forward-referenced payment_status enum value landing in a later
    // task in this plan (Task 10, Phase 1). This code is written against that future contract on purpose.
    if (cancelRequest.refund_window_met) {
      const { data: payment, error: paymentLookupError } = await supabase
        .from('payments')
        .select('id, payment_status, total_amount')
        .eq('booking_id', cancelRequest.booking_id)
        .eq('payment_status', 'completed')
        .single()

      if (paymentLookupError) {
        console.error('[API] POST /academic-head/cancellation-requests/[id]/respond payment lookup error:', paymentLookupError.message)
      }

      if (payment) {
        await supabase
          .from('payments')
          .update({ payment_status: 'refund_requested', updated_at: new Date().toISOString() })
          .eq('id', payment.id)

        await sendNotificationToRoles(supabase, ['building_admin'], {
          title: 'Refund Owed — Cancellation Approved',
          message: `A cancellation was approved for a paid booking (refund window met). Please process the refund in Payment Management.`,
          type: 'warning',
          source_type: 'cancellation_request',
          source_id: requestId,
          priority: 'high',
        })

        const amountLabel = (payment as any).total_amount != null
          ? `₱${Number((payment as any).total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
          : '—'
        const adminEmails = await getBuildingAdminEmails()
        if (adminEmails.length > 0) {
          const { subject, htmlBody } = buildingAdminRefundOwedEmail({
            bookingRef: booking.booking_reference,
            amount: amountLabel,
          })
          await sendBrevoEmail({ to: adminEmails, subject, htmlBody }).catch(err =>
            console.error('[cancellation-respond] Failed to email building admins:', err)
          )
        }
      }
    }

    // If with strike, increment consecutive_cancellations
    if (action === 'approve_with_strike') {
      const { data: userData } = await supabase
        .from('users')
        .select('consecutive_cancellations')
        .eq('id', cancelRequest.user_id)
        .single()

      const newCount = ((userData?.consecutive_cancellations as number) ?? 0) + 1
      await supabase
        .from('users')
        .update({ consecutive_cancellations: newCount, updated_at: new Date().toISOString() })
        .eq('id', cancelRequest.user_id)

      await sendNotification(supabase, {
        user_id: cancelRequest.user_id,
        title: 'Cancellation Approved (Strike Applied)',
        message: `Your cancellation for booking ${booking.booking_reference} has been approved. This counts as a cancellation strike (${newCount}/3).`,
        type: 'warning',
        source_type: 'cancellation_request',
        source_id: requestId,
        priority: 'high',
      })
    } else {
      await sendNotification(supabase, {
        user_id: cancelRequest.user_id,
        title: 'Cancellation Approved',
        message: `Your cancellation for booking ${booking.booking_reference} has been approved. No strike applied.`,
        type: 'success',
        source_type: 'cancellation_request',
        source_id: requestId,
        priority: 'normal',
      })
    }

    return NextResponse.json({ success: true, action })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] POST /academic-head/cancellation-requests/[id]/respond error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
