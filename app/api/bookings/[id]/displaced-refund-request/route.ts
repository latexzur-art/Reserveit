import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { getBuildingAdminEmails, resolveUserPageUrls } from '@/backend/notifications/recipientResolver'

const BodySchema = z.object({
  refund_destination_name: z.string().min(1).optional(),
  refund_destination_contact_number: z.string().min(1).optional(),
})

/**
 * POST /api/bookings/[id]/displaced-refund-request
 * User declines a school-event reschedule and requests a refund instead.
 * Distinct from request-cancellation because:
 * - awaiting_reschedule is not in CANCELLABLE_STATUSES
 * - No strike should apply (displacement wasn't user's fault)
 * - Auto-approved (no AH review needed)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { id } = await params
  const supabase = createAdminClient()

  let body: unknown
  try { body = await request.json() } catch { body = {} }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  // Load booking
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, user_id, booking_reference, current_status, block_event_id, booking_date')
    .eq('id', id)
    .single()

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }
  if (booking.user_id !== user!.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (booking.current_status !== 'awaiting_reschedule') {
    return NextResponse.json({ error: 'Booking is not awaiting reschedule' }, { status: 400 })
  }

  // Check for completed payment
  const { data: payment } = await supabase
    .from('payments')
    .select('id, total_amount')
    .eq('booking_id', id)
    .eq('payment_status', 'completed')
    .maybeSingle()

  const hasPayment = !!payment
  const { refund_destination_name, refund_destination_contact_number } = parsed.data

  // Validate refund destination for paid bookings
  if (hasPayment && (!refund_destination_name || !refund_destination_contact_number)) {
    return NextResponse.json(
      { error: 'Refund destination details required for paid booking' },
      { status: 400 }
    )
  }

  // Cancel the booking
  await supabase
    .from('bookings')
    .update({
      current_status: 'cancelled',
      cancellation_type: 'displaced_refund',
      backend_cancellation_reason: 'User declined reschedule after school event displacement',
      block_event_id: null,
      reschedule_deadline: null,
    })
    .eq('id', id)

  // Create cancellation request for audit trail
  await supabase.from('cancellation_requests').insert({
    booking_id: id,
    user_id: user!.id,
    reason: 'Declined reschedule after school event displacement — requesting refund',
    original_status: 'awaiting_reschedule',
    status: 'auto_approved',
    auto_approved: true,
    refund_window_met: true,
    refund_destination_name: refund_destination_name ?? null,
    refund_destination_contact_number: refund_destination_contact_number ?? null,
  })

  if (hasPayment) {
    // Mark payment as refund requested
    await supabase
      .from('payments')
      .update({ payment_status: 'refund_requested', updated_at: new Date().toISOString() })
      .eq('id', payment!.id)

    // Notify BA to process refund
    await sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'Refund Request — Displaced Booking',
      message: `User declined reschedule for booking ${booking.booking_reference}. Process refund of ₱${Number(payment!.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}.`,
      type: 'warning',
      source_type: 'booking',
      source_id: id,
      priority: 'high',
    })

    // Email BA
    const adminEmails = await getBuildingAdminEmails()
    if (adminEmails.length > 0) {
      await sendBrevoEmail({
        to: adminEmails,
        subject: `[ReserveIT] Refund Request — ${booking.booking_reference}`,
        htmlBody: `<p>User declined reschedule for booking <strong>${booking.booking_reference}</strong>.</p>
                   <p>Refund amount: <strong>₱${Number(payment!.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></p>
                   <p>Destination: ${refund_destination_name} (${refund_destination_contact_number})</p>
                   <p>Please process the refund in Payment Management.</p>`,
      }).catch(console.error)
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // Notify user
  await sendNotification(supabase, {
    user_id: user!.id,
    title: hasPayment ? 'Refund Requested' : 'Booking Cancelled',
    message: hasPayment
      ? `Your booking ${booking.booking_reference} has been cancelled. A refund will be processed.`
      : `Your booking ${booking.booking_reference} has been cancelled.`,
    type: 'success',
    source_type: 'booking',
    source_id: id,
    priority: 'normal',
    action_url: `${baseUrl}${(await resolveUserPageUrls(supabase, user!.id)).bookingsUrl}`,
  })

  return NextResponse.json({ success: true, has_payment: hasPayment })
}
