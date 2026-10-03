/**
 * Notifications for the professor-assignment workflow — in-app + Brevo email.
 * Email goes to each user's notification_email (falls back to email), mirroring
 * the booking pipeline's recipient rule.
 * @module backend/schedule/assignmentNotifications
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'

const SOURCE = 'professor_assignment'
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtTime(raw?: string | null) {
  if (!raw) return ''
  const [h, m = '00'] = raw.split(':')
  const hr = parseInt(h, 10)
  return `${hr === 0 ? 12 : hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

function slot(d: number, s: string, e: string) {
  return `${DAY_NAMES[d] ?? '?'} ${fmtTime(s)}–${fmtTime(e)}`
}

function emailShell(heading: string, bodyHtml: string) {
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <h2 style="color:#050d36;margin:0 0 12px">${heading}</h2>
    ${bodyHtml}
    <p style="color:#64748b;font-size:12px;margin-top:24px">ReserveIT — STI College Lucena. This is an automated message.</p>
  </div>`
}

/** Email a single user via notification_email (preferred) or email. No-op if neither. */
async function emailUser(
  supabase: SupabaseClient,
  userId: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const { data } = await supabase
    .from('users')
    .select('email, notification_email')
    .eq('id', userId)
    .single()
  const to = data?.notification_email ?? data?.email ?? null
  if (!to) {
    console.warn(`[assignmentNotifications] no email for user ${userId} — email skipped`)
    return
  }
  void sendBrevoEmail({ to, subject, htmlBody })
}

/** PH submitted a lineup → notify academic heads (in-app + email). */
export async function notifyAssignmentRequest(
  supabase: SupabaseClient,
  lineupId: string,
  creatorName: string,
  itemCount: number
): Promise<void> {
  await sendNotificationToRoles(supabase, ['academic_head'], {
    title: 'New Professor Assignment Lineup',
    message: `${creatorName} submitted ${itemCount} professor assignment(s) for review.`,
    type: 'info',
    source_type: SOURCE,
    source_id: lineupId,
  })

  const { data: ahs } = await supabase
    .from('user_roles')
    .select('user_id, roles!inner(name)')
    .eq('roles.name', 'academic_head')
    .eq('is_active', true)
  const ids = [...new Set((ahs ?? []).map((u: { user_id: string }) => u.user_id))]
  const html = emailShell(
    'New professor assignment lineup',
    `<p><strong>${creatorName}</strong> submitted <strong>${itemCount}</strong> professor assignment(s) for your review.</p>
     <p>Open ReserveIT → Schedules → Professor Assignments to approve, override, or reject.</p>`
  )
  await Promise.all(ids.map((id) => emailUser(supabase, id, 'New professor assignment lineup to review', html)))
}

/** Lineup approved/rejected → notify the requester (in-app + email). */
export async function notifyRequesterDecision(
  supabase: SupabaseClient,
  requesterId: string,
  approved: boolean,
  opts: { lineupId: string; applied?: number; skipped?: number; notes?: string }
): Promise<void> {
  const partial = approved && (opts.skipped ?? 0) > 0
  const title = approved
    ? partial ? 'Assignment Lineup Partially Approved' : 'Assignment Lineup Approved'
    : 'Assignment Lineup Rejected'
  const message = approved
    ? `${opts.applied ?? 0} professor assignment(s) applied${partial ? `, ${opts.skipped} skipped (conflict)` : ''}.`
    : `Your professor assignment lineup was rejected.${opts.notes ? ` Reason: ${opts.notes}` : ''}`

  await sendNotification(supabase, {
    user_id: requesterId,
    title,
    message,
    type: approved ? (partial ? 'warning' : 'success') : 'error',
    source_type: SOURCE,
    source_id: opts.lineupId,
  })

  const html = emailShell(
    title,
    `<p>${message}</p>${opts.notes && approved ? `<p>Reviewer notes: ${opts.notes}</p>` : ''}`
  )
  await emailUser(supabase, requesterId, title, html)
}

/**
 * Notify each professor who was assigned in a lineup (in-app + email).
 * Reads the lineup's approved items and groups sections per professor.
 */
export async function notifyAssignedProfessors(
  supabase: SupabaseClient,
  lineupId: string
): Promise<void> {
  const { data: items } = await supabase
    .from('professor_assignment_items')
    .select(`
      proposed_instructor_id,
      schedule:class_schedules!class_schedule_id(
        course_code, course_name, section, day_of_week, start_time, end_time,
        facilities(name, room_number)
      )
    `)
    .eq('lineup_id', lineupId)
    .eq('status', 'approved')

  // Group approved sections by professor (skip Unassigned/no-user items).
  const byProf = new Map<string, string[]>()
  for (const it of items ?? []) {
    if (!it.proposed_instructor_id) continue
    const cs: any = Array.isArray(it.schedule) ? it.schedule[0] : it.schedule
    if (!cs) continue
    const room = cs.facilities?.name || cs.facilities?.room_number || 'TBA room'
    const line = `${cs.course_code} ${cs.section} — ${slot(cs.day_of_week, cs.start_time, cs.end_time)} @ ${room}`
    const arr = byProf.get(it.proposed_instructor_id) ?? []
    arr.push(line)
    byProf.set(it.proposed_instructor_id, arr)
  }

  await Promise.all(
    [...byProf.entries()].map(async ([profId, lines]) => {
      const count = lines.length
      await sendNotification(supabase, {
        user_id: profId,
        title: 'You have been assigned to teach',
        message: `You were assigned to ${count} section${count === 1 ? '' : 's'}: ${lines.join('; ')}.`,
        type: 'info',
        source_type: SOURCE,
        source_id: lineupId,
      })
      const html = emailShell(
        'You have been assigned to teach',
        `<p>You have been assigned to the following section${count === 1 ? '' : 's'}:</p>
         <ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
         <p>View details in ReserveIT → My Schedules.</p>`
      )
      await emailUser(supabase, profId, `You have been assigned to ${count} section${count === 1 ? '' : 's'}`, html)
    })
  )
}

import { professorAssignedEmail, professorUnassignedEmail } from '@/backend/notifications/emailTemplates'

/** Notify a professor when they are unassigned from a section (in-app + Brevo email). */
export async function notifyDirectUnassign(
  supabase: SupabaseClient,
  profId: string,
  schedule: { course_code: string; section: string; day_of_week: number; start_time: string; end_time: string }
): Promise<void> {
  const slotStr = slot(schedule.day_of_week, schedule.start_time, schedule.end_time)
  const title = `Unassigned from ${schedule.course_code} ${schedule.section}`
  const message = `You were unassigned from ${schedule.course_code} ${schedule.section} (${slotStr}).`

  await sendNotification(supabase, {
    user_id: profId,
    title,
    message,
    type: 'warning',
    source_type: SOURCE,
  })

  // Get user profile full name for template
  const { data: profUser } = await supabase.from('profiles').select('full_name').eq('id', profId).single()
  const profName = profUser?.full_name ?? 'Professor'

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/faculty/schedule`
  const { subject, htmlBody } = professorUnassignedEmail({
    profName,
    courseCode: schedule.course_code,
    section: schedule.section,
    dayTime: slotStr,
    dashboardUrl,
  })

  await emailUser(supabase, profId, subject, htmlBody)
}

/** Notify a professor when they are directly assigned to teach a section (in-app + Brevo email). */
export async function notifyDirectAssign(
  supabase: SupabaseClient,
  profId: string,
  schedule: { course_code: string; course_name?: string; section: string; day_of_week: number; start_time: string; end_time: string }
): Promise<void> {
  const slotStr = slot(schedule.day_of_week, schedule.start_time, schedule.end_time)
  const title = `Assigned to teach ${schedule.course_code} ${schedule.section}`
  const message = `You were assigned to teach ${schedule.course_code} ${schedule.section} (${slotStr}).`

  await sendNotification(supabase, {
    user_id: profId,
    title,
    message,
    type: 'info',
    source_type: SOURCE,
  })

  // Get user profile full name for template
  const { data: profUser } = await supabase.from('profiles').select('full_name').eq('id', profId).single()
  const profName = profUser?.full_name ?? 'Professor'

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/faculty/schedule`
  const { subject, htmlBody } = professorAssignedEmail({
    profName,
    courseCode: schedule.course_code,
    courseName: schedule.course_name,
    section: schedule.section,
    dayTime: slotStr,
    dashboardUrl,
  })

  await emailUser(supabase, profId, subject, htmlBody)
}
