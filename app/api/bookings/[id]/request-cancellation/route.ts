import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { isRefundWindowMet, getManilaDateString } from '@/lib/refund-eligibility'

const idSchema = z.uuid()

const BodySchema = z.object({
  reason: z.string().min(20, 'Reason must be at least 20 characters').max(1000),
  refund_destination_name: z.string().min(1).optional(),
  refund_destination_contact_number: z.string().min(1).optional(),
  refund_destination_qr_url: z.string().url().nullable().optional(),
})

const CANCELLABLE_STATUSES = ['pending', 'auto_approved', 'approved', 'flagged', 'pending_user_response', 'awaiting_reschedule']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { id: rawId } = await params
  const idCheck = idSchema.safeParse(rawId)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 })
  }
  const bookingId = idCheck.data

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

  const { reason, refund_destination_name, refund_destination_contact_number, refund_destination_qr_url } = parsed.data
  const supabase = createAdminClient()

  try {
    // Load the booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, user_id, current_status, booking_reference, booking_date')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Only booking owner can request cancellation
    if (booking.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Booking must be in a cancellable status
    if (!CANCELLABLE_STATUSES.includes(booking.current_status)) {
      return NextResponse.json(
        { error: `Cannot request cancellation for booking with status: ${booking.current_status}` },
        { status: 400 }
      )
    }

    // Check for existing pending request
    const { data: existingRequest } = await supabase
      .from('cancellation_requests')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A cancellation request is already pending for this booking' },
        { status: 409 }
      )
    }

    // Check whether the booking has any non-cancelled/failed payment (drives routing + refund eligibility)
    const { data: payment, error: paymentLookupError } = await supabase
      .from('payments')
      .select('id, payment_status')
      .eq('booking_id', bookingId)
      .not('payment_status', 'in', '(cancelled,failed)')
      .maybeSingle()

    if (paymentLookupError) {
      console.error('[API] POST /bookings/[id]/request-cancellation payment lookup error:', paymentLookupError.message)
    }

    const hasPayment = !!payment
    const isCompletedPayment = payment?.payment_status === 'completed'

    if (isCompletedPayment && (!refund_destination_name || !refund_destination_contact_number)) {
      return NextResponse.json(
        { error: 'refund_destination_name and refund_destination_contact_number are required for a paid booking' },
        { status: 400 }
      )
    }

    const refundWindowMet = isCompletedPayment
      ? isRefundWindowMet(booking.booking_date, getManilaDateString())
      : false

    // Create the cancellation request
    const { data: newRequest, error: insertError } = await supabase
      .from('cancellation_requests')
      .insert({
        booking_id: bookingId,
        user_id: user.id,
        reason,
        original_status: booking.current_status,
        status: 'pending',
        refund_window_met: refundWindowMet,
        refund_destination_name: refund_destination_name ?? null,
        refund_destination_contact_number: refund_destination_contact_number ?? null,
        refund_destination_qr_url: refund_destination_qr_url ?? null,
      })
      .select('id')
      .single()

    if (insertError || !newRequest) {
      return NextResponse.json({ error: 'Failed to create cancellation request' }, { status: 500 })
    }

    // Update booking status to cancellation_requested
    await supabase.rpc('update_booking_status', {
      p_booking_id: bookingId,
      p_new_status: 'cancellation_requested',
      p_changed_by_user_id: user.id,
      p_changed_by_ai: false,
      p_reason: `Cancellation requested: ${reason}`,
      p_metadata: { cancellation_request_id: newRequest.id },
    })

    // Route notification: Building Admin for paid reservations (AH has no say in paid reservations), Academic Head for academic bookings
    const targetRoles = hasPayment ? ['building_admin'] : ['academic_head']
    const refundNote = hasPayment
      ? refundWindowMet
        ? ' (Paid Reservation — Eligible for full refund)'
        : ' (Paid Reservation — Outside standard refund window)'
      : ''

    await sendNotificationToRoles(supabase, targetRoles, {
      title: hasPayment ? 'New Paid Booking Cancellation Request' : 'New Cancellation Request',
      message: `Cancellation requested for ${hasPayment ? 'paid reservation' : 'booking'} ${booking.booking_reference}. Reason: ${reason}${refundNote}`,
      type: 'warning',
      source_type: 'cancellation_request',
      source_id: newRequest.id,
      priority: 'high',
    })

    return NextResponse.json(
      { success: true, request_id: newRequest.id },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] POST /bookings/[id]/request-cancellation error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { id: rawId } = await params
  const idCheck = idSchema.safeParse(rawId)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 })
  }
  const bookingId = idCheck.data
  const supabase = createAdminClient()

  try {
    // Find the pending request for this booking
    const { data: cancelRequest } = await supabase
      .from('cancellation_requests')
      .select('id, user_id, original_status')
      .eq('booking_id', bookingId)
      .eq('status', 'pending')
      .maybeSingle()

    if (!cancelRequest) {
      return NextResponse.json({ error: 'No pending cancellation request found' }, { status: 404 })
    }

    if (cancelRequest.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cancel the request
    await supabase
      .from('cancellation_requests')
      .update({ status: 'cancelled' })
      .eq('id', cancelRequest.id)

    // Revert booking to original status
    await supabase.rpc('update_booking_status', {
      p_booking_id: bookingId,
      p_new_status: cancelRequest.original_status,
      p_changed_by_user_id: user.id,
      p_changed_by_ai: false,
      p_reason: 'Cancellation request withdrawn by user',
      p_metadata: { cancellation_request_id: cancelRequest.id, action: 'user_withdraw' },
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] DELETE /bookings/[id]/request-cancellation error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
