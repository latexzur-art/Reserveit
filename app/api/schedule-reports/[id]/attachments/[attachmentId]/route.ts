import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { ScheduleIssueReportsService } from '@/backend/schedule/schedule-issue-reports.service'
import { apiError, apiUnexpectedError } from '@/lib/api/response'

/** DELETE — remove an attachment (owner or building_admin). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const { id: reportId, attachmentId } = await params

  // Verify ownership or building_admin role
  const supabase = createAdminClient()
  const { data: report, error: reportErr } = await supabase
    .from('schedule_issue_reports')
    .select('id, reported_by')
    .eq('id', reportId)
    .single()

  if (reportErr || !report) return apiError(404, 'Report not found')

  const roles = (user!.roles ?? []).map((r: { name: string }) => r.name)
  const isOwner = report.reported_by === user!.id
  const isAdmin = roles.includes('building_admin')

  if (!isOwner && !isAdmin) {
    return apiError(403, 'You can only delete your own attachments')
  }

  try {
    await ScheduleIssueReportsService.deleteAttachment(attachmentId)
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiUnexpectedError('DELETE /api/schedule-reports/[id]/attachments/[attachmentId]', err)
  }
}
