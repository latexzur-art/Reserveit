import { SupabaseClient } from '@supabase/supabase-js'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { scheduleBatchDecisionEmail, ScheduleDecisionOutcome } from '@/backend/notifications/emailTemplates'

const SAMPLE_LIMIT = 10

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function dayTime(dayOfWeek: number | null, start: string | null, end: string | null) {
  const dayLabel = typeof dayOfWeek === 'number' && DAY_NAMES[dayOfWeek] ? DAY_NAMES[dayOfWeek] : '—'
  const range = start && end ? `${start.slice(0, 5)} – ${end.slice(0, 5)}` : '—'
  return `${dayLabel} ${range}`.trim()
}

export interface NotifyScheduleDecisionOptions {
  uploadId: string
  reviewerId: string
  reviewerName: string
  outcome: ScheduleDecisionOutcome
  approvedCount: number
  rejectedCount: number
  cancelledBookingCount?: number
  supersededCount?: number
  decisionNotes?: string | null
  /** Path the in-app notification action button should deep-link to, for the recipient. */
  recipientDashboardPath: (recipientId: string) => string
}

async function loadSamples(
  supabase: SupabaseClient,
  uploadId: string,
): Promise<{
  approvedSample: { courseCode: string; section: string; dayTime: string }[]
  rejectedSample: { courseCode: string; section: string; reason: string }[]
}> {
  const [{ data: approvedRows }, { data: rejectedRows }] = await Promise.all([
    supabase
      .from('schedule_entries_staging')
      .select('course_code, section, day_of_week, start_time, end_time')
      .eq('schedule_upload_id', uploadId)
      .eq('academic_head_review_status', 'academic_head_approved')
      .order('day_of_week', { ascending: true, nullsFirst: false })
      .limit(SAMPLE_LIMIT),
    supabase
      .from('schedule_entries_staging')
      .select('course_code, section, academic_head_review_notes, validation_errors')
      .eq('schedule_upload_id', uploadId)
      .in('academic_head_review_status', ['academic_head_rejected'])
      .order('created_at', { ascending: true, nullsFirst: true })
      .limit(SAMPLE_LIMIT),
  ])

  const approvedSample = (approvedRows ?? []).map((r) => ({
    courseCode: r.course_code ?? '—',
    section: r.section ?? '',
    dayTime: dayTime(r.day_of_week, r.start_time, r.end_time),
  }))

  const rejectedSample = (rejectedRows ?? []).map((r: any) => {
    const errs = Array.isArray(r.validation_errors) ? r.validation_errors : []
    const firstErr = errs[0]?.message ?? errs[0]?.code ?? null
    return {
      courseCode: r.course_code ?? '—',
      section: r.section ?? '',
      reason: r.academic_head_review_notes ?? firstErr ?? 'No reason provided',
    }
  })

  return { approvedSample, rejectedSample }
}

const OUTCOME_TITLE: Record<ScheduleDecisionOutcome, string> = {
  published: 'Schedule Published',
  partially_published: 'Schedule Partially Published',
  rejected: 'Schedule Rejected',
  rolled_back: 'Schedule Rolled Back',
}

const OUTCOME_NOTIF_TYPE: Record<ScheduleDecisionOutcome, 'success' | 'warning' | 'error' | 'info'> = {
  published: 'success',
  partially_published: 'warning',
  rejected: 'error',
  rolled_back: 'warning',
}

export async function notifyScheduleDecision(
  supabase: SupabaseClient,
  opts: NotifyScheduleDecisionOptions,
): Promise<void> {
  const {
    uploadId,
    reviewerId,
    reviewerName,
    outcome,
    approvedCount,
    rejectedCount,
    cancelledBookingCount,
    supersededCount,
    decisionNotes,
    recipientDashboardPath,
  } = opts

  const { data: upload } = await supabase
    .from('schedule_uploads')
    .select(`
      uploaded_by,
      users:uploaded_by ( full_name, email, notification_email ),
      departments:department_id ( name ),
      academic_terms:academic_term_id ( term_name, academic_year )
    `)
    .eq('id', uploadId)
    .single()

  if (!upload) return

  const submitterId = (upload as any).uploaded_by as string | null
  if (!submitterId || submitterId === reviewerId) return

  const userObj = Array.isArray((upload as any).users) ? (upload as any).users[0] : (upload as any).users
  const deptObj = Array.isArray((upload as any).departments) ? (upload as any).departments[0] : (upload as any).departments
  const termObj = Array.isArray((upload as any).academic_terms) ? (upload as any).academic_terms[0] : (upload as any).academic_terms

  const submitterName = userObj?.full_name ?? 'Submitter'
  const departmentName = deptObj?.name ?? 'Unknown Department'
  const termName = termObj
    ? `${termObj.term_name ?? ''}${termObj.academic_year ? ` (${termObj.academic_year})` : ''}`.trim()
    : 'Unknown Term'

  const { approvedSample, rejectedSample } = await loadSamples(supabase, uploadId)

  const summaryParts: string[] = []
  if (approvedCount > 0) summaryParts.push(`${approvedCount} published`)
  if (rejectedCount > 0) summaryParts.push(`${rejectedCount} rejected`)
  if ((cancelledBookingCount ?? 0) > 0) summaryParts.push(`${cancelledBookingCount} booking${cancelledBookingCount === 1 ? '' : 's'} cancelled`)
  if ((supersededCount ?? 0) > 0) summaryParts.push(`${supersededCount} schedule${supersededCount === 1 ? '' : 's'} superseded`)

  const actionUrl = recipientDashboardPath(submitterId)

  await sendNotification(supabase, {
    user_id: submitterId,
    title: OUTCOME_TITLE[outcome],
    message: `Your schedule upload for ${departmentName} — ${termName} was ${outcome.replace('_', ' ')}. ${summaryParts.join(', ')}.`.trim(),
    type: OUTCOME_NOTIF_TYPE[outcome],
    source_type: 'schedule_upload',
    source_id: uploadId,
    priority: outcome === 'published' ? 'normal' : 'high',
    action_url: actionUrl,
    metadata: {
      upload_id: uploadId,
      outcome,
      approved_count: approvedCount,
      rejected_count: rejectedCount,
      cancelled_booking_count: cancelledBookingCount ?? 0,
      superseded_count: supersededCount ?? 0,
      reviewed_by: reviewerName,
      reviewed_at: new Date().toISOString(),
    },
  })

  // Email — fire-and-forget
  void (async () => {
    try {
      if (!userObj) return
      const to = userObj.notification_email ?? null
      if (!to) {
        console.warn(`[notifyScheduleDecision] Submitter "${submitterName}" has no notification_email set — decision email skipped`)
        return
      }

      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}${actionUrl}`
      const { subject, htmlBody } = scheduleBatchDecisionEmail({
        submitterName,
        departmentName,
        termName,
        outcome,
        approvedCount,
        rejectedCount,
        cancelledBookingCount,
        supersededCount,
        approvedSample,
        rejectedSample,
        decisionNotes,
        reviewedByName: reviewerName,
        reviewedAt: new Date().toLocaleString('en-PH', {
          timeZone: 'Asia/Manila',
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
        dashboardUrl,
      })

      await sendBrevoEmail({ to, subject, htmlBody })
    } catch (err) {
      console.error('[notifyScheduleDecision] email failed:', err)
    }
  })()
}
