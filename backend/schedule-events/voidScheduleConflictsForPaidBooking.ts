import type { SupabaseClient } from '@supabase/supabase-js'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { classScheduleBlockedRescheduleOfferEmail } from '@/backend/notifications/emailTemplates'
import { timeToMinutes } from './voidSchoolEventConflicts'

/**
 * When a paid gym reservation is confirmed (payment completed), void any class
 * schedules that conflict with the same facility and time on that date.
 *
 * Priority order: school events > paid reservations > class schedules.
 *
 * Inserts class_schedule_exceptions for each conflicting schedule on that date,
 * then sends one notification each to:
 *   - the instructor of each voided class
 *   - program heads whose department owns an affected class
 *   - all academic heads
 */
const RESCHEDULE_DEADLINE_HOURS = 72

export async function voidScheduleConflictsForPaidBooking(
  supabase: SupabaseClient,
  facility_id: string,
  booking_date: string,
  start_time: string,
  end_time: string,
  booking_reference: string,
  booking_id?: string,
): Promise<{ schedulesVoided: number }> {
  const bookingStartM = timeToMinutes(start_time)
  const bookingEndM = timeToMinutes(end_time)

  // Parse date to local day-of-week (0=Sun … 6=Sat, matches DB convention)
  const [yr, mo, dy] = booking_date.split('-').map(Number)
  const dayOfWeek = new Date(yr, mo - 1, dy).getDay()

  // Find active class schedules for this facility that run on this day
  // and whose active term covers booking_date
  const { data: candidates } = await supabase
    .from('class_schedules')
    .select('id, start_time, end_time')
    .eq('facility_id', facility_id)
    .eq('is_active', true)
    .eq('day_of_week', dayOfWeek)
    .lte('effective_start_date', booking_date)
    .gte('effective_end_date', booking_date)

  const overlappingIds = (candidates ?? [])
    .filter((cs: any) => {
      const csStartM = timeToMinutes(cs.start_time)
      const csEndM = timeToMinutes(cs.end_time)
      return csStartM < bookingEndM && csEndM > bookingStartM
    })
    .map((cs: any) => cs.id as string)

  if (overlappingIds.length === 0) return { schedulesVoided: 0 }

  // Skip any already voided on this date (idempotent on webhook retries)
  const { data: existing } = await supabase
    .from('class_schedule_exceptions')
    .select('schedule_id')
    .in('schedule_id', overlappingIds)
    .eq('exception_date', booking_date)

  const alreadyVoided = new Set((existing ?? []).map((e: any) => e.schedule_id as string))
  const toVoid = overlappingIds.filter(id => !alreadyVoided.has(id))

  if (toVoid.length === 0) return { schedulesVoided: 0 }

  await supabase
    .from('class_schedule_exceptions')
    .insert(
      toVoid.map(sid => ({
        schedule_id: sid,
        exception_date: booking_date,
        reason: `Voided due to Paid Reservation: ${booking_reference}`,
      }))
    )

  // Fetch full schedule details for notifications + reschedule offers
  const { data: affected } = await supabase
    .from('class_schedules')
    .select('id, instructor_id, course_code, course_name, section, department_id, start_time, end_time, facility_id, facilities(name)')
    .in('id', toVoid)

  const schedules = affected ?? []
  const roomName = (schedules[0]?.facilities as any)?.name ?? ''
  const voidedLabel = schedules.map((cs: any) => `${cs.course_code} ${cs.section}`).join(', ')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ''
  const deadline = new Date(Date.now() + RESCHEDULE_DEADLINE_HOURS * 60 * 60 * 1000).toISOString()
  const adminMessage =
    `${schedules.length === 1 ? `Class ${voidedLabel}` : `Classes ${voidedLabel}`}` +
    `${roomName ? ` at ${roomName}` : ''} on ${booking_date} ` +
    `${schedules.length === 1 ? 'has been' : 'have been'} voided because paid reservation ` +
    `${booking_reference} has priority use of the facility at that time.`

  // Create reschedule offers for each schedule (reuse school-event pattern)
  for (const cs of schedules) {
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
      block_event_id: booking_id ?? null,
      affected_date: booking_date,
      instructor_user_id: cs.instructor_id ?? null,
      status: 'pending',
      deadline,
    })
  }

  // 1. Notify each instructor — reschedule offer, not just void
  const notifiedInstructors = new Set<string>()
  for (const cs of schedules) {
    if (!cs.instructor_id || notifiedInstructors.has(cs.instructor_id)) continue
    notifiedInstructors.add(cs.instructor_id)
    await sendNotification(supabase, {
      user_id: cs.instructor_id,
      title: 'Class Voided — Reschedule Required',
      message:
        `Your class ${cs.course_code} ${cs.section}${roomName ? ` at ${roomName}` : ''} ` +
        `on ${booking_date} is voided because paid reservation (${booking_reference}) ` +
        `has priority. Please reschedule before ${new Date(deadline).toLocaleString()}.`,
      type: 'warning',
      source_type: 'special_event',
      priority: 'high',
      action_url: `${baseUrl}/faculty/class-reschedule/${cs.id}?date=${booking_date}`,
    })

    // Email the instructor
    const { data: instrUser } = await supabase
      .from('users').select('email, full_name').eq('id', cs.instructor_id).single()
    if (instrUser?.email) {
      const { subject, htmlBody } = classScheduleBlockedRescheduleOfferEmail({
        instructorName: instrUser.full_name ?? instrUser.email,
        courseCode: cs.course_code ?? cs.course_name ?? 'Course',
        section: cs.section ?? '',
        affectedDate: booking_date,
        facilityName: roomName || 'N/A',
        eventName: `Paid Reservation ${booking_reference}`,
        deadline: new Date(deadline).toLocaleString(),
        rescheduleUrl: `${baseUrl}/faculty/class-reschedule/${cs.id}?date=${booking_date}`,
      })
      await sendBrevoEmail({ to: instrUser.email, subject, htmlBody }).catch(() => {})
    }
  }

  // 2. Notify program heads whose department owns at least one affected class
  const affectedDeptIds = [...new Set(schedules.map((cs: any) => cs.department_id).filter(Boolean))] as string[]
  if (affectedDeptIds.length > 0) {
    // Find all program_head role user IDs first
    const { data: phRoleRows } = await supabase
      .from('user_roles')
      .select('user_id, roles!inner(name)')
      .in('roles.name', ['program_head'])
      .eq('is_active', true)

    const phUserIds = (phRoleRows ?? []).map((r: any) => r.user_id as string).filter(Boolean)

    if (phUserIds.length > 0) {
      // Then filter to those in the affected departments
      const { data: phUsers } = await supabase
        .from('users')
        .select('id')
        .in('id', phUserIds)
        .in('department_id', affectedDeptIds)
        .eq('is_active', true)

      const notifiedPHs = new Set<string>()
      for (const u of (phUsers ?? [])) {
        if (notifiedPHs.has(u.id)) continue
        notifiedPHs.add(u.id)
        await sendNotification(supabase, {
          user_id: u.id,
          title: 'Class Voided in Your Department — Paid Reservation',
          message: adminMessage,
          type: 'warning',
          source_type: 'booking',
          priority: 'high',
        })
      }
    }
  }

  // 3. Notify all academic heads
  await sendNotificationToRoles(supabase, ['academic_head'], {
    title: 'Class Voided — Paid Reservation',
    message: adminMessage,
    type: 'warning',
    source_type: 'booking',
    priority: 'high',
  })

  return { schedulesVoided: toVoid.length }
}
