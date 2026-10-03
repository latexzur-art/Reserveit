import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { ScheduleIssueReportsService } from '@/backend/schedule/schedule-issue-reports.service'
import { canTriageScheduleReport } from '@/lib/schedule/report-policy'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'

const rolesOf = (user: any): string[] => (user?.roles ?? []).map((r: any) => r.name)

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
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
    const { id: rawId, attachmentId: rawAttId } = await params
    const idParsed = parseUuidParam(rawId, 'report id')
    if (!idParsed.ok) return idParsed.response

    const attIdParsed = parseUuidParam(rawAttId, 'attachment id')
    if (!attIdParsed.ok) return attIdParsed.response

    const result = await ScheduleIssueReportsService.deleteAttachment(attIdParsed.value)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
