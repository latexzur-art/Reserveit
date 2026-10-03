import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { resolveUserEmail } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { cancellationRequestRejectedEmail, cancellationRequestApprovedEmail } from '@/backend/notifications/emailTemplates'

const idSchema = z.uuid()

const BodySchema = z.object({
  action: z.enum(['approve_no_strike', 'approve_with_strike', 'approve_full_refund', 'approve_no_refund', 'reject']),
  review_notes: z.string().max(1000).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

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
    // Load cancellation request
    const { data: cancelRequest, error: fetchError } = await supabase
      .from('cancellation_requests')
      .select('id, booking_id, user_id, status, reason, original_status, refund_window_met')
      .eq('id', requestId)
      .single()

    if (fetchError || !cancelRequest) {
      return NextResponse.json({ error: 'Cancellation request not found' }, { status: 404 })
    }

    if (cancelRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot respond to cancellation request with status: ${cancelRequest.status}` },
        { status: 400 }
      )
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, current_status, booking_reference')
      .eq('id', cancelRequest.booking_id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Associated booking not found' }, { status: 404 })
    }

    // Update cancellation request status
    const isApprove = action !== 'reject'
    const newRequestStatus = isApprove ? 'approved_no_strike' : 'rejected'

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
        p_reason: `Cancellation request rejected by Building Admin: ${review_notes ?? 'No reason provided'}`,
        p_metadata: { cancellation_request_id: requestId, action: 'reject' },
      })

      await sendNotification(supabase, {
        user_id: cancelRequest.user_id,
        title: 'Cancellation Request Rejected',
        message: `Your cancellation request for booking ${booking.booking_reference} was rejected by the Building Admin. The booking remains active.`,
        type: 'warning',
        source_type: 'cancellation_request',
        source_id: requestId,
        priority: 'normal',
      })

      // Email user about rejection
      const { emailTo, name } = await resolveUserEmail(supabase, cancelRequest.user_id)
      if (emailTo) {
        const { subject, htmlBody } = cancellationRequestRejectedEmail({
          userName: name ?? 'User',
          bookingRef: booking.booking_reference,
          reason: review_notes ?? 'No reason provided',
        })
        void sendBrevoEmail({ to: emailTo, subject, htmlBody }).catch(console.error)
      }

      return NextResponse.json({ success: true, action: 'rejected' })
    }

    // Approve — cancel the booking immediately, freeing the facility schedule
    await supabase.rpc('update_booking_status', {
      p_booking_id: cancelRequest.booking_id,
      p_new_status: 'cancelled',
      p_changed_by_user_id: user.id,
      p_changed_by_ai: false,
      p_reason: `Cancellation approved by Building Admin: ${cancelRequest.reason}`,
      p_metadata: { cancellation_request_id: requestId, action },
    })

    // Stamp cancellation type
    await supabase
      .from('bookings')
      .update({ cancellation_type: 'cancellation_approved', backend_cancellation_reason: cancelRequest.reason })
      .eq('id', cancelRequest.booking_id)

    // Check if there is a completed payment
    const { data: payment } = await supabase
      .from('payments')
      .select('id, payment_status')
      .eq('booking_id', cancelRequest.booking_id)
      .eq('payment_status', 'completed')
      .maybeSingle()

    const refundOwed = !!payment && (cancelRequest.refund_window_met || action === 'approve_full_refund')

    if (refundOwed && payment) {
      // Set payment status to refund_requested so Building Admin can issue refund in Payment Management
      await supabase
        .from('payments')
        .update({
          payment_status: 'refund_requested',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)
    }

    await sendNotification(supabase, {
      user_id: cancelRequest.user_id,
      title: 'Cancellation Approved',
      message: `Your cancellation request for booking ${booking.booking_reference} has been approved by the Building Admin.${refundOwed ? ' Your refund is being processed.' : ''}`,
      type: 'info',
      source_type: 'cancellation_request',
      source_id: requestId,
      priority: 'high',
    })

    // Email user about approval
    const { emailTo: approveEmail, name: approveName } = await resolveUserEmail(supabase, cancelRequest.user_id)
    if (approveEmail) {
      const { subject, htmlBody } = cancellationRequestApprovedEmail({
        userName: approveName ?? 'User',
        bookingRef: booking.booking_reference,
        refundOwed: refundOwed,
      })
      void sendBrevoEmail({ to: approveEmail, subject, htmlBody }).catch(console.error)
    }

    return NextResponse.json({ success: true, action: 'approved', refund_owed: refundOwed })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] POST /admin/building/cancellation-requests/[id]/respond error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
