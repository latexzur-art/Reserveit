import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  rescheduleOfferExpiredEmail,
} from '@/backend/notifications/emailTemplates'
import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { resolveUserPageUrls } from '@/backend/notifications/recipientResolver'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/reschedule-offer-expiry
 * Runs every 15 minutes.
 * 1. Cancels awaiting_reschedule bookings whose deadline has passed.
 * 2. Expires class_schedule_reschedule_offers whose deadline has passed.
 * Secured with CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // ── 1. Expire booking reschedule offers ──────────────────────────────────────
  const { data: expiredBookings } = await supabase
    .from('bookings')
    .select('id, user_id, booking_reference, booking_date, start_time, end_time, original_date, original_start_time, original_end_time')
    .eq('current_status', 'awaiting_reschedule')
    .lt('reschedule_deadline', now)

  let bookingsCancelled = 0
  for (const b of expiredBookings ?? []) {
    await supabase
      .from('bookings')
      .update({
        current_status: 'cancelled',
        cancellation_type: 'facility_unavailable',
        backend_cancellation_reason: 'Reschedule offer expired — no response within deadline.',
        block_event_id: null,
        reschedule_deadline: null,
      })
      .eq('id', b.id)

    bookingsCancelled++

    // Refund-entitlement hook: if a completed payment exists, mark it refund_requested and notify admins
    const { data: completedPayment } = await supabase
      .from('payments')
      .select('id, payment_status')
      .eq('booking_id', b.id)
      .eq('payment_status', 'completed')
      .single()

    if (completedPayment) {
      await supabase
        .from('payments')
        .update({ payment_status: 'refund_requested', updated_at: new Date().toISOString() })
        .eq('id', completedPayment.id)

      await sendNotificationToRoles(supabase, ['building_admin'], {
        title: 'Refund Owed — Reschedule Offer Expired',
        message: `Booking ${b.booking_reference ?? b.id} was cancelled after the reschedule deadline expired, but a completed payment exists. Please process the refund in Payment Management.`,
        type: 'warning',
        source_type: 'booking',
        source_id: b.id,
        priority: 'high',
      })
    }

    if (!b.user_id) continue

    // Resolve role-appropriate URL for this user
    const { bookingsUrl } = await resolveUserPageUrls(supabase, b.user_id)

    await supabase.from('notifications').insert({
      user_id: b.user_id,
      title: 'Reschedule Deadline Expired — Booking Cancelled',
      message: `Your booking${b.booking_reference ? ` (${b.booking_reference})` : ''} was cancelled because no new slot was chosen before the deadline.`,
      type: 'error',
      source_type: 'booking',
      source_id: b.id,
      priority: 'high',
      read: false,
      action_url: `${baseUrl}${bookingsUrl}`,
    })

    // Email the booking owner
    const { data: userRow } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', b.user_id)
      .single()

    if (userRow?.email) {
      const { subject, htmlBody } = rescheduleOfferExpiredEmail({
        userName: userRow.full_name ?? userRow.email,
        bookingReference: b.booking_reference ?? b.id,
        originalDate: (b.original_date ?? b.booking_date) as string,
        eventName: 'School Event',
        contactUrl: `${baseUrl}${bookingsUrl}`,
      })
      await sendBrevoEmail({ to: userRow.email, subject, htmlBody })
    }
  }

  // ── 2. Expire class schedule reschedule offers ────────────────────────────────
  const { data: expiredOffers } = await supabase
    .from('class_schedule_reschedule_offers')
    .select('id, class_schedule_id, affected_date, instructor_user_id')
    .eq('status', 'pending')
    .lt('deadline', now)

  let offersCancelled = 0
  for (const offer of expiredOffers ?? []) {
    await supabase
      .from('class_schedule_reschedule_offers')
      .update({ status: 'expired' })
      .eq('id', offer.id)

    // Ensure class_schedule_exception exists to mark the session as cancelled for that date
    await supabase
      .from('class_schedule_exceptions')
      .upsert({
        schedule_id: offer.class_schedule_id,
        exception_date: offer.affected_date,
        reason: 'Reschedule offer expired — session cancelled for this date.',
      }, { onConflict: 'schedule_id,exception_date' })

    offersCancelled++

    if (!offer.instructor_user_id) continue

    await supabase.from('notifications').insert({
      user_id: offer.instructor_user_id,
      title: 'Class Reschedule Deadline Expired',
      message: `The reschedule offer for your class session on ${offer.affected_date} expired. The session for that date is marked as cancelled.`,
      type: 'warning',
      source_type: 'special_event',
      priority: 'normal',
      read: false,
    })
  }

  return NextResponse.json({
    success: true,
    bookingsCancelled,
    offersCancelled,
    processedAt: now,
  })
}
