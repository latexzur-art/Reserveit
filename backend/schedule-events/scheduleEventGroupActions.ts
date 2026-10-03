import type { SupabaseClient } from '@supabase/supabase-js'
import { NotificationService } from '@/backend/notifications/notification.service'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  specialEventReviewRequestEmail,
  specialEventApprovedEmail,
  specialEventDeclinedEmail,
  specialEventInstantPublishedEmail,
} from '@/backend/notifications/templates/special-events'
import { createScheduleEventGroup, type CreateScheduleEventGroupParams, type CreateScheduleEventGroupResult } from './createScheduleEventGroup'
import { applySchoolEventBlock } from './applySchoolEventBlock'
import { fetchGroupRows, fetchFacilityIdsByBookingDate, fetchUsersByRole, summarizeDates, type GroupRow } from './scheduleEventGroupHelpers'

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'FORBIDDEN' | 'INVALID_STATUS' | 'NOT_FOUND' | 'VALIDATION'; message: string }

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? ''
const dashboardUrlFor = (role: string) =>
  role === 'academic_head' ? `${baseUrl()}/academic/schedules/events` : `${baseUrl()}/admin/building/school-events`

async function emailRole(
  supabase: SupabaseClient,
  role: string,
  build: (u: { email: string; full_name: string | null }) => { subject: string; htmlBody: string }
) {
  const users = await fetchUsersByRole(supabase, role)
  for (const u of users) {
    const { subject, htmlBody } = build(u)
    await sendBrevoEmail({ to: u.email, subject, htmlBody })
  }
}

/**
 * Creates a grouped School Event / Exam Period submission and sends the corresponding
 * creation-side notification per spec §5: an FYI to Academic Head when Building Admin creates
 * (instant, already live), or a review request to Building Admin when Academic Head creates
 * (pending, nothing voided yet).
 */
export async function createGroup(
  supabase: SupabaseClient,
  params: CreateScheduleEventGroupParams,
  requesterName: string
): Promise<CreateScheduleEventGroupResult> {
  const result = await createScheduleEventGroup(supabase, params)

  const isAcademicHead = params.actorRole === 'academic_head'
  await supabase
    .from('bookings')
    .update({
      event_requires_approval: isAcademicHead,
      event_requested_by_role: params.actorRole,
      event_approval_status: isAcademicHead ? 'pending' : null,
    })
    .eq('group_id', result.group_id)

  const rows = await fetchGroupRows(supabase, result.group_id)
  const dates = summarizeDates(rows)
  const byDate = await fetchFacilityIdsByBookingDate(supabase, rows)
  const facilityCount = new Set([...byDate.values()].flatMap((v) => v.facilityIds)).size

  if (isAcademicHead) {
    await NotificationService.createForRoles(['building_admin'], {
      title: 'School Event Request Pending Review',
      message: `${requesterName} requested a school event: "${params.event_name}" (${dates}).`,
      type: 'info',
      source_type: 'special_event',
      source_id: result.group_id,
      priority: 'high',
      action_url: dashboardUrlFor('building_admin'),
    })
    await emailRole(supabase, 'building_admin', (u) =>
      specialEventReviewRequestEmail({
        reviewerName: u.full_name ?? u.email,
        requesterName,
        requesterRole: 'Academic Head',
        eventName: params.event_name,
        eventDate: dates,
        startTime: params.start_time,
        endTime: params.end_time,
        facilities: `${facilityCount} facilit${facilityCount === 1 ? 'y' : 'ies'}`,
        reviewUrl: dashboardUrlFor('building_admin'),
      })
    )
  } else {
    await NotificationService.createForRoles(['academic_head'], {
      title: `School Event Published: ${params.event_name}`,
      message: `${requesterName} published a school event: "${params.event_name}" (${dates}).`,
      type: 'info',
      source_type: 'special_event',
      source_id: result.group_id,
      priority: 'normal',
      action_url: dashboardUrlFor('academic_head'),
    })
    await emailRole(supabase, 'academic_head', (u) =>
      specialEventInstantPublishedEmail({
        reviewerName: u.full_name ?? u.email,
        creatorName: requesterName,
        creatorRole: 'Building Admin',
        eventName: params.event_name,
        eventDate: dates,
        startTime: params.start_time,
        endTime: params.end_time,
        facilities: `${facilityCount} facilit${facilityCount === 1 ? 'y' : 'ies'}`,
        dashboardUrl: dashboardUrlFor('academic_head'),
      })
    )
  }

  return result
}

/** Approves a pending Academic-Head-originated group: only Building Admin may call this. */
export async function approveGroup(
  supabase: SupabaseClient,
  groupId: string,
  approverId: string,
  approverName: string
): Promise<ActionResult<{ bookingsVoided: number; schedulesVoided: number }>> {
  const rows = await fetchGroupRows(supabase, groupId)
  if (rows.length === 0) return { ok: false, code: 'NOT_FOUND', message: 'Group not found' }
  if (rows[0].current_status !== 'pending') {
    return { ok: false, code: 'INVALID_STATUS', message: 'Only pending groups can be approved' }
  }

  const decidedAt = new Date().toISOString()
  await supabase
    .from('bookings')
    .update({
      current_status: 'auto_approved',
      event_approval_status: 'approved',
      event_decided_by: approverId,
      event_decided_at: decidedAt,
    })
    .eq('group_id', groupId)

  const byDate = await fetchFacilityIdsByBookingDate(supabase, rows)
  let bookingsVoided = 0
  let schedulesVoided = 0
  for (const [date, { anchorBookingId, facilityIds }] of byDate) {
    const { bookingsAffected, schedulesAffected } = await applySchoolEventBlock(
      supabase,
      facilityIds,
      date,
      rows[0].start_time,
      rows[0].end_time,
      rows[0].event_name,
      anchorBookingId,
      'offer_reschedule'
    )
    bookingsVoided += bookingsAffected
    schedulesVoided += schedulesAffected
  }

  const requesterId = rows[0].user_id
  const { data: requester } = await supabase.from('users').select('email, full_name').eq('id', requesterId).single()
  const requestedByRole = rows[0].event_requested_by_role ?? 'academic_head'
  await NotificationService.create({
    user_id: requesterId,
    title: `School Event Approved: ${rows[0].event_name}`,
    message: `Your school event "${rows[0].event_name}" has been approved by Building Admin.`,
    type: 'success',
    source_type: 'special_event',
    source_id: groupId,
    priority: 'high',
    action_url: dashboardUrlFor(requestedByRole),
  })
  if (requester?.email) {
    const { subject, htmlBody } = specialEventApprovedEmail({
      requesterName: requester.full_name ?? requester.email,
      eventName: rows[0].event_name,
      eventDate: summarizeDates(rows),
      startTime: rows[0].start_time,
      endTime: rows[0].end_time,
      facilities: `${[...byDate.values()].flatMap((v) => v.facilityIds).length} facility slot(s)`,
      decidedBy: approverName,
      dashboardUrl: dashboardUrlFor(requestedByRole),
    })
    await sendBrevoEmail({ to: requester.email, subject, htmlBody })
  }

  return { ok: true, data: { bookingsVoided, schedulesVoided } }
}

/** Rejects a pending group. Requires a non-empty reason. Never runs void logic. */
export async function rejectGroup(
  supabase: SupabaseClient,
  groupId: string,
  approverId: string,
  approverName: string,
  reason: string
): Promise<ActionResult<null>> {
  if (!reason || !reason.trim()) {
    return { ok: false, code: 'VALIDATION', message: 'A reason is required when declining' }
  }
  const rows = await fetchGroupRows(supabase, groupId)
  if (rows.length === 0) return { ok: false, code: 'NOT_FOUND', message: 'Group not found' }
  if (rows[0].current_status !== 'pending') {
    return { ok: false, code: 'INVALID_STATUS', message: 'Only pending groups can be rejected' }
  }

  await supabase
    .from('bookings')
    .update({
      current_status: 'cancelled',
      event_approval_status: 'declined',
      event_decided_by: approverId,
      event_decided_at: new Date().toISOString(),
      event_decision_notes: reason,
    })
    .eq('group_id', groupId)

  const requesterId = rows[0].user_id
  const { data: requester } = await supabase.from('users').select('email, full_name').eq('id', requesterId).single()
  const requestedByRole = rows[0].event_requested_by_role ?? 'academic_head'
  await NotificationService.create({
    user_id: requesterId,
    title: `School Event Declined: ${rows[0].event_name}`,
    message: `Your school event request "${rows[0].event_name}" was declined: ${reason}`,
    type: 'warning',
    source_type: 'special_event',
    source_id: groupId,
    priority: 'high',
    action_url: dashboardUrlFor(requestedByRole),
  })
  if (requester?.email) {
    const { subject, htmlBody } = specialEventDeclinedEmail({
      requesterName: requester.full_name ?? requester.email,
      eventName: rows[0].event_name,
      eventDate: summarizeDates(rows),
      decidedBy: approverName,
      reason,
      dashboardUrl: dashboardUrlFor(requestedByRole),
    })
    await sendBrevoEmail({ to: requester.email, subject, htmlBody })
  }

  return { ok: true, data: null }
}

/** Withdraws the caller's own still-pending request. No Building Admin step needed. */
export async function withdrawGroup(
  supabase: SupabaseClient,
  groupId: string,
  requesterId: string
): Promise<ActionResult<null>> {
  const rows = await fetchGroupRows(supabase, groupId)
  if (rows.length === 0) return { ok: false, code: 'NOT_FOUND', message: 'Group not found' }
  if (rows.some((r) => r.user_id !== requesterId)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Only the requester can withdraw this group' }
  }
  if (rows[0].current_status !== 'pending') {
    return { ok: false, code: 'INVALID_STATUS', message: 'Only pending groups can be withdrawn' }
  }

  await supabase
    .from('bookings')
    .update({ current_status: 'cancelled', event_approval_status: 'declined' })
    .eq('group_id', groupId)

  await NotificationService.createForRoles(['building_admin'], {
    title: `School Event Request Withdrawn: ${rows[0].event_name}`,
    message: `The request for "${rows[0].event_name}" was withdrawn by its requester.`,
    type: 'info',
    source_type: 'special_event',
    source_id: groupId,
    priority: 'normal',
    action_url: dashboardUrlFor('building_admin'),
  })

  return { ok: true, data: null }
}

export type { GroupRow }
