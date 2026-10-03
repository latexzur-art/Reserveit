import type { SupabaseClient } from '@supabase/supabase-js'
import { NotificationService } from '@/backend/notifications/notification.service'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  schoolEventCancellationRequestedEmail,
  schoolEventCancellationConfirmedEmail,
  schoolEventCancellationDeclinedEmail,
} from '@/backend/notifications/templates/special-events'
import { timeToMinutes } from './applySchoolEventBlock'
import { fetchGroupRows, fetchFacilityIdsByBookingDate, fetchUsersByRole, summarizeDates } from './scheduleEventGroupHelpers'
import type { ActionResult } from './scheduleEventGroupActions'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { AdminAuditService } from '@/backend/admin/admin-audit.service'

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? ''
const dashboardUrlFor = (role: string) =>
  role === 'academic_head' ? `${baseUrl()}/academic/schedules/events` : `${baseUrl()}/admin/building/school-events`

/**
 * BA cancelling (own or an approved AH-originated group) is immediate -- today's existing
 * behavior, unchanged, no new gate/notification. AH cancelling only ever files a request: the
 * block stays live until BA confirms (spec §5's "AH requests, BA confirms" asymmetry).
 */
export async function requestOrExecuteCancellation(
  supabase: SupabaseClient,
  groupId: string,
  actorRole: 'academic_head' | 'building_admin',
  actorId: string,
  actorName: string
): Promise<ActionResult<{ immediate: boolean }>> {
  const rows = await fetchGroupRows(supabase, groupId)
  if (rows.length === 0) return { ok: false, code: 'NOT_FOUND', message: 'Group not found' }
  if (rows[0].current_status !== 'auto_approved') {
    return { ok: false, code: 'INVALID_STATUS', message: 'Only an active group can be cancelled' }
  }

  if (actorRole === 'building_admin') {
    await restoreDisplacedBookingsForGroup(supabase, rows)
    await cleanupClassScheduleExceptionsForGroup(supabase, rows)
    await supabase.from('bookings').update({ current_status: 'cancelled' }).eq('group_id', groupId)

    void AdminAuditService.log({
      actorId,
      action: 'school_event_group_cancelled',
      targetType: 'special_event',
      targetId: groupId,
      details: { event_name: rows[0].event_name, booking_count: rows.length },
    })

    return { ok: true, data: { immediate: true } }
  }

  await supabase.from('bookings').update({ current_status: 'cancellation_requested' }).eq('group_id', groupId)

  await NotificationService.createForRoles(['building_admin'], {
    title: `Cancellation Requested: ${rows[0].event_name}`,
    message: `${actorName} requested cancellation of "${rows[0].event_name}".`,
    type: 'warning',
    source_type: 'special_event',
    source_id: groupId,
    priority: 'high',
    action_url: dashboardUrlFor('building_admin'),
  })
  const reviewers = await fetchUsersByRole(supabase, 'building_admin')
  const byDate = await fetchFacilityIdsByBookingDate(supabase, rows)
  const facilityCount = new Set([...byDate.values()].flatMap((v) => v.facilityIds)).size
  for (const reviewer of reviewers) {
    const { subject, htmlBody } = schoolEventCancellationRequestedEmail({
      reviewerName: reviewer.full_name ?? reviewer.email,
      requesterName: actorName,
      requesterRole: 'Academic Head',
      eventName: rows[0].event_name,
      dates: summarizeDates(rows),
      facilities: `${facilityCount} facility(ies)`,
      reviewUrl: dashboardUrlFor('building_admin'),
    })
    await sendBrevoEmail({ to: reviewer.email, subject, htmlBody })
  }

  return { ok: true, data: { immediate: false } }
}

async function cleanupClassScheduleExceptionsForGroup(supabase: SupabaseClient, rows: any[]) {
  const byDate = await fetchFacilityIdsByBookingDate(supabase, rows)
  for (const [date, { facilityIds }] of byDate) {
    if (facilityIds.length === 0) continue
    const row = rows.find((r) => r.booking_date === date)!
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay()
    const eventStartM = timeToMinutes(row.start_time)
    const eventEndM = timeToMinutes(row.end_time)

    const { data: schedules } = await supabase
      .from('class_schedules')
      .select('id, day_of_week, start_time, end_time')
      .in('facility_id', facilityIds)
      .eq('is_active', true)

    const affectedScheduleIds = (schedules ?? [])
      .filter((cs: any) => {
        const days = Array.isArray(cs.day_of_week) ? cs.day_of_week : [cs.day_of_week]
        if (!days.includes(dayOfWeek)) return false
        const csStartM = timeToMinutes(cs.start_time)
        const csEndM = timeToMinutes(cs.end_time)
        return csStartM < eventEndM && csEndM > eventStartM
      })
      .map((cs: any) => cs.id)

    if (affectedScheduleIds.length > 0) {
      await supabase
        .from('class_schedule_exceptions')
        .delete()
        .in('schedule_id', affectedScheduleIds)
        .eq('exception_date', date)
    }
  }
}

/**
 * Restores bookings displaced by a school event back to their original slot.
 * Called when the school event is cancelled — the displacement reason no longer exists,
 * so the bookings should be restored rather than left in `awaiting_reschedule`.
 */
async function restoreDisplacedBookingsForGroup(supabase: SupabaseClient, rows: any[]) {
  const groupBookingIds = rows.map(r => r.id)

  // Find displaced bookings that haven't been rescheduled yet
  const { data: displaced } = await supabase
    .from('bookings')
    .select('id, user_id, booking_reference, original_date, original_start_time, original_end_time, original_facility_id')
    .in('block_event_id', groupBookingIds)
    .eq('current_status', 'awaiting_reschedule')

  if (!displaced?.length) return

  for (const b of displaced) {
    await supabase
      .from('bookings')
      .update({
        current_status: 'auto_approved',
        booking_date: b.original_date,
        start_time: b.original_start_time,
        end_time: b.original_end_time,
        block_event_id: null,
        reschedule_deadline: null,
        original_date: null,
        original_start_time: null,
        original_end_time: null,
        original_facility_id: null,
      })
      .eq('id', b.id)

    await sendNotification(supabase, {
      user_id: b.user_id,
      title: 'Booking Restored',
      message: `Your booking (${b.booking_reference}) has been restored to its original slot since the school event was cancelled.`,
      type: 'success',
      source_type: 'booking',
      source_id: b.id,
      priority: 'normal',
    })
  }

  // Clean up pending class reschedule offers
  await supabase
    .from('class_schedule_reschedule_offers')
    .delete()
    .in('block_event_id', groupBookingIds)
    .eq('status', 'pending')
}

/**
 * BA-only immediate hard delete (route layer enforces the guard) -- today's thorough-delete
 * behavior (class_schedule_exceptions cleanup) looped over every row in the group instead of one.
 * Not exposed to Academic Head: AH cancels via requestOrExecuteCancellation, per spec §6.
 */
export async function deleteGroup(supabase: SupabaseClient, groupId: string): Promise<ActionResult<null>> {
  const rows = await fetchGroupRows(supabase, groupId)
  if (rows.length === 0) return { ok: false, code: 'NOT_FOUND', message: 'Group not found' }

  await restoreDisplacedBookingsForGroup(supabase, rows)
  await cleanupClassScheduleExceptionsForGroup(supabase, rows)
  await supabase.from('bookings').delete().eq('group_id', groupId).eq('booking_type', 'school_event_block')

  return { ok: true, data: null }
}

/** BA-only. Only valid on cancellation_requested. Confirms the cancellation and runs cleanup. */
export async function confirmCancellation(
  supabase: SupabaseClient,
  groupId: string,
  approverId: string,
  approverName: string
): Promise<ActionResult<null>> {
  const rows = await fetchGroupRows(supabase, groupId)
  if (rows.length === 0) return { ok: false, code: 'NOT_FOUND', message: 'Group not found' }
  if (rows[0].current_status !== 'cancellation_requested') {
    return { ok: false, code: 'INVALID_STATUS', message: 'Only a group awaiting cancellation confirmation can be confirmed' }
  }

  await restoreDisplacedBookingsForGroup(supabase, rows)
  await cleanupClassScheduleExceptionsForGroup(supabase, rows)

  await supabase
    .from('bookings')
    .update({
      current_status: 'cancelled',
      event_decided_by: approverId,
      event_decided_at: new Date().toISOString(),
    })
    .eq('group_id', groupId)

  void AdminAuditService.log({
    actorId: approverId,
    action: 'school_event_cancellation_confirmed',
    targetType: 'special_event',
    targetId: groupId,
    details: { event_name: rows[0].event_name, booking_count: rows.length },
  })

  const requesterId = rows[0].user_id
  const { data: requester } = await supabase.from('users').select('email, full_name').eq('id', requesterId).single()
  const requestedByRole = rows[0].event_requested_by_role ?? 'academic_head'
  await NotificationService.create({
    user_id: requesterId,
    title: `Cancellation Confirmed: ${rows[0].event_name}`,
    message: `Your cancellation request for "${rows[0].event_name}" has been confirmed by Building Admin.`,
    type: 'info',
    source_type: 'special_event',
    source_id: groupId,
    priority: 'normal',
    action_url: dashboardUrlFor(requestedByRole),
  })
  if (requester?.email) {
    const { subject, htmlBody } = schoolEventCancellationConfirmedEmail({
      requesterName: requester.full_name ?? requester.email,
      eventName: rows[0].event_name,
      dates: summarizeDates(rows),
      decidedBy: approverName,
      dashboardUrl: dashboardUrlFor(requestedByRole),
    })
    await sendBrevoEmail({ to: requester.email, subject, htmlBody })
  }

  return { ok: true, data: null }
}

/** BA-only. Only valid on cancellation_requested. Reverts the group back to active. */
export async function declineCancellation(
  supabase: SupabaseClient,
  groupId: string,
  approverId: string,
  approverName: string
): Promise<ActionResult<null>> {
  const rows = await fetchGroupRows(supabase, groupId)
  if (rows.length === 0) return { ok: false, code: 'NOT_FOUND', message: 'Group not found' }
  if (rows[0].current_status !== 'cancellation_requested') {
    return { ok: false, code: 'INVALID_STATUS', message: 'Only a group awaiting cancellation confirmation can be declined' }
  }

  await supabase
    .from('bookings')
    .update({
      current_status: 'auto_approved',
      event_decided_by: approverId,
      event_decided_at: new Date().toISOString(),
    })
    .eq('group_id', groupId)

  const requesterId = rows[0].user_id
  const { data: requester } = await supabase.from('users').select('email, full_name').eq('id', requesterId).single()
  const requestedByRole = rows[0].event_requested_by_role ?? 'academic_head'
  await NotificationService.create({
    user_id: requesterId,
    title: `Cancellation Declined: ${rows[0].event_name}`,
    message: `Your cancellation request for "${rows[0].event_name}" was declined. The block stays active.`,
    type: 'info',
    source_type: 'special_event',
    source_id: groupId,
    priority: 'normal',
    action_url: dashboardUrlFor(requestedByRole),
  })
  if (requester?.email) {
    const { subject, htmlBody } = schoolEventCancellationDeclinedEmail({
      requesterName: requester.full_name ?? requester.email,
      eventName: rows[0].event_name,
      dates: summarizeDates(rows),
      decidedBy: approverName,
      dashboardUrl: dashboardUrlFor(requestedByRole),
    })
    await sendBrevoEmail({ to: requester.email, subject, htmlBody })
  }

  return { ok: true, data: null }
}
