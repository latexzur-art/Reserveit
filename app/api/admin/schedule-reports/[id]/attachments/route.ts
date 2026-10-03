import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { ScheduleIssueReportsService } from '@/backend/schedule/schedule-issue-reports.service'
import { canTriageScheduleReport } from '@/lib/schedule/report-policy'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'

const rolesOf = (user: any): string[] => (user?.roles ?? []).map((r: any) => r.name)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const roles = rolesOf(user)
  if (!canTriageScheduleReport(roles)) {
    return NextResponse.json(
      { error: 'Forbidden: triage role required' },
      { status: 403 },
    )
  }

  try {
    const { id: rawId } = await params
    const idParsed = parseUuidParam(rawId, 'report id')
    if (!idParsed.ok) return idParsed.response

    const attachments = await ScheduleIssueReportsService.getAttachments(idParsed.value)
    return NextResponse.json({ attachments })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
