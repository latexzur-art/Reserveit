import type { SupabaseClient } from '@supabase/supabase-js'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  reservationBlockedRescheduleOfferEmail,
  classScheduleBlockedRescheduleOfferEmail,
} from '@/backend/notifications/emailTemplates'

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export interface ApplyBlockResult {
  bookingsAffected: number
  schedulesAffected: number
}

const RESCHEDULE_DEADLINE_HOURS = 72

/**
 * Applies a school event block against overlapping bookings and class schedules.
 *
 * mode='offer_reschedule' (default):
 *   - Sets overlapping bookings to `awaiting_reschedule` state and sends reschedule offer notifications.
 *   - Creates class_schedule_reschedule_offers for overlapping class sessions (and class_schedule_exceptions to hide them).
 *
 * mode='hard_cancel':
 *   - Legacy: cancels bookings and creates class_schedule_exceptions only. No reschedule offers.
 */
export async function applySchoolEventBlock(
  supabase: SupabaseClient,
  facility_ids: string[],
  booking_date: string,
  start_time: string,
  end_time: string,
  event_name: string,
  event_booking_id: string,
  mode: 'offer_reschedule' | 'hard_cancel' = 'offer_reschedule',
): Promise<ApplyBlockResult> {
  const eventStartM = timeToMinutes(start_time)
  const eventEndM = timeToMinutes(end_time)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ''

  // ── 1. Find conflicting standard bookings ────────────────────────────────────
  const { data: facilityBookingLinks } = await supabase
    .from('booking_facilities')
    .select('booking_id, facility_id')
    .in('facility_id', facility_ids)

  const linkMap = new Map<string, string>() // booking_id → facility_id
  for (const l of facilityBookingLinks ?? []) {
    linkMap.set(l.booking_id, l.facility_id)
  }
  const facilityBookingIds = [...linkMap.keys()]

  let overlappingBookings: any[] = []
  if (facilityBookingIds.length > 0) {
    const { data: conflictData } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, start_time, end_time, event_name, purpose')
      .in('id', facilityBookingIds)
      .eq('booking_date', booking_date)
      .neq('booking_purpose', 'school_event')
      .in('current_status', ['pending', 'approved', 'auto_approved', 'flagged'])

    overlappingBookings = (conflictData ?? []).filter((b: any) => {
      const bStartM = timeToMinutes(b.start_time)
      const bEndM = timeToMinutes(b.end_time)
      return bStartM < eventEndM && bEndM > eventStartM
    })
  }
  const overlapIds = overlappingBookings.map((b: any) => b.id)

  if (overlapIds.length > 0) {
    if (mode === 'hard_cancel') {
      await supabase
        .from('bookings')
        .update({
          current_status: 'cancelled',
          cancellation_type: 'admin_cancelled',
          backend_cancellation_reason: `Cancelled due to School Event: ${event_name}`,
        })
        .in('id', overlapIds)

      for (const b of overlappingBookings) {
        if (!b.user_id) continue
        await sendNotification(supabase, {
          user_id: b.user_id,
          title: 'Reservation Cancelled — School Event',
          message: `Your booking${b.booking_reference ? ` (${b.booking_reference})` : ''} on ${booking_date} was cancelled because "${event_name}" is scheduled for that facility and time.`,
          type: 'warning',
          source_type: 'booking',
          source_id: b.id,
          priority: 'high',
        })
      }
    } else {
      // offer_reschedule mode
      const deadline = new Date(Date.now() + RESCHEDULE_DEADLINE_HOURS * 60 * 60 * 1000).toISOString()

      for (const b of overlappingBookings) {
        const facilityId = linkMap.get(b.id) ?? null

        await supabase
          .from('bookings')
          .update({
            current_status: 'awaiting_reschedule',
            block_event_id: event_booking_id,
            reschedule_deadline: deadline,
            original_date: booking_date,
            original_start_time: b.start_time,
            original_end_time: b.end_time,
            original_facility_id: facilityId,
          })
          .eq('id', b.id)

        if (!b.user_id) continue

        await sendNotification(supabase, {
          user_id: b.user_id,
          title: 'Booking Displaced — Reschedule Required',
          message: `Your booking${b.booking_reference ? ` (${b.booking_reference})` : ''} on ${booking_date} was displaced by "${event_name}". Please pick a new time before ${new Date(deadline).toLocaleString()}.`,
          type: 'warning',
          source_type: 'special_event',
          source_id: b.id,
          priority: 'high',
          action_url: `${baseUrl}/reservations/reschedule/${b.id}`,
        })

        // Send email to booking owner
        const { data: userRow } = await supabase
          .from('users')
          .select('email, full_name')
          .eq('id', b.user_id)
          .single()

        if (userRow?.email) {
          const { data: facilityRow } = facilityId
            ? await supabase.from('facilities').select('name').eq('id', facilityId).single()
            : { data: null }
          const { subject, htmlBody } = reservationBlockedRescheduleOfferEmail({
            userName: userRow.full_name ?? userRow.email,
            bookingReference: b.booking_reference ?? b.id,
            eventName: event_name,
            originalDate: booking_date,
            originalStart: b.start_time,
            originalEnd: b.end_time,
            facilityName: facilityRow?.name ?? 'N/A',
            deadline: new Date(deadline).toLocaleString(),
            rescheduleUrl: `${baseUrl}/reservations/reschedule/${b.id}`,
          })
          await sendBrevoEmail({ to: userRow.email, subject, htmlBody })
        }
      }
    }
  }

  // ── 2. Find conflicting class schedules ──────────────────────────────────────
  const eventDateObj = new Date(`${booking_date}T00:00:00`)
  const dayOfWeek = eventDateObj.getDay()

  const { data: scheduleConflicts } = await supabase
    .from('class_schedules')
    .select('id, day_of_week, start_time, end_time, instructor_id, instructor_name, course_code, course_name, section, facility_id, facilities(name)')
    .in('facility_id', facility_ids)
    .eq('is_active', true)
    .lte('effective_start_date', booking_date)
    .gte('effective_end_date', booking_date)

  const overlappingSchedules = (scheduleConflicts ?? []).filter((cs: any) => {
    const days = Array.isArray(cs.day_of_week) ? cs.day_of_week : [cs.day_of_week]
    if (!days.includes(dayOfWeek)) return false
    const csStartM = timeToMinutes(cs.start_time)
    const csEndM = timeToMinutes(cs.end_time)
    return csStartM < eventEndM && csEndM > eventStartM
  })

  const scheduleOverlapIds = overlappingSchedules.map((cs: any) => cs.id)

  if (scheduleOverlapIds.length > 0) {
    // Always create exceptions to hide class from calendar on this date
    const existingExceptions = await supabase
      .from('class_schedule_exceptions')
      .select('schedule_id')
      .in('schedule_id', scheduleOverlapIds)
      .eq('exception_date', booking_date)
    const alreadyExcepted = new Set((existingExceptions.data ?? []).map((e: any) => e.schedule_id))

    const newExceptions = scheduleOverlapIds
      .filter((sid: string) => !alreadyExcepted.has(sid))
      .map((sid: string) => ({
        schedule_id: sid,
        exception_date: booking_date,
        reason: `Displaced by School Event: ${event_name}`,
      }))
    if (newExceptions.length > 0) {
      await supabase.from('class_schedule_exceptions').insert(newExceptions)
    }

    if (mode === 'offer_reschedule') {
      const deadline = new Date(Date.now() + RESCHEDULE_DEADLINE_HOURS * 60 * 60 * 1000).toISOString()

      for (const cs of overlappingSchedules) {
        // Check for duplicate offer
        const { data: existing } = await supabase
          .from('class_schedule_reschedule_offers')
          .select('id')
          .eq('class_schedule_id', cs.id)
          .eq('affected_date', booking_date)
          .eq('status', 'pending')
          .maybeSingle()
        if (existing) continue

        await supabase.from('class_schedule_reschedule_offers').insert({
          class_schedule_id: cs.id,
          block_event_id: event_booking_id,
          affected_date: booking_date,
          instructor_user_id: cs.instructor_id ?? null,
          status: 'pending',
          deadline,
        })

        if (!cs.instructor_id) continue

        const roomName = (cs.facilities as any)?.name ?? ''
        await sendNotification(supabase, {
          user_id: cs.instructor_id,
          title: 'Class Session Displaced — Reschedule Required',
          message: `Your class ${cs.course_code ?? cs.course_name} ${cs.section}${roomName ? ` at ${roomName}` : ''} is displaced on ${booking_date} by "${event_name}". Please reschedule the session.`,
          type: 'warning',
          source_type: 'special_event',
          priority: 'high',
          action_url: `${baseUrl}/faculty/class-reschedule/${cs.id}?date=${booking_date}`,
        })

        // Email the instructor
        const { data: instrUser } = await supabase
          .from('users')
          .select('email, full_name')
          .eq('id', cs.instructor_id)
          .single()
        if (instrUser?.email) {
          const { subject, htmlBody } = classScheduleBlockedRescheduleOfferEmail({
            instructorName: instrUser.full_name ?? instrUser.email,
            courseCode: cs.course_code ?? cs.course_name ?? 'Course',
            section: cs.section ?? '',
            affectedDate: booking_date,
            facilityName: roomName || 'N/A',
            eventName: event_name,
            deadline: new Date(deadline).toLocaleString(),
            rescheduleUrl: `${baseUrl}/faculty/class-reschedule/${cs.id}?date=${booking_date}`,
          })
          await sendBrevoEmail({ to: instrUser.email, subject, htmlBody })
        }
      }
    } else {
      // hard_cancel: notify instructors of suspension (no reschedule offer)
      const notified = new Set<string>()
      for (const cs of overlappingSchedules) {
        if (!cs.instructor_id || notified.has(cs.instructor_id)) continue
        notified.add(cs.instructor_id)
        const roomName = (cs.facilities as any)?.name ?? ''
        await sendNotification(supabase, {
          user_id: cs.instructor_id,
          title: 'Class Suspended — School Event',
          message: `Your class ${cs.course_code ?? cs.course_name} ${cs.section}${roomName ? ` at ${roomName}` : ''} is suspended on ${booking_date} due to "${event_name}".`,
          type: 'warning',
          source_type: 'booking',
          priority: 'high',
        })
      }
    }
  }

  return {
    bookingsAffected: overlapIds.length,
    schedulesAffected: scheduleOverlapIds.length,
  }
}
