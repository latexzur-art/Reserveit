import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { ScheduleIssueReportsService } from '@/backend/schedule/schedule-issue-reports.service'
import { canTriageScheduleReport } from '@/lib/schedule/report-policy'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'

const rolesOf = (user: any): string[] => (user?.roles ?? []).map((r: any) => r.name)

const Schema = z.object({
  status: z.enum(['pending', 'under_review', 'resolved', 'dismissed']),
  resolutionNotes: z.string().max(2000).nullish(),
})

export async function PATCH(
  request: NextRequest,
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

    const parsed = Schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Validation error' },
        { status: 400 },
      )
    }

    const report = await ScheduleIssueReportsService.updateStatus(idParsed.value, {
      status: parsed.data.status,
      resolutionNotes: parsed.data.resolutionNotes,
      resolvedBy: user!.id,
    })
    return NextResponse.json(report)
  } catch (err) {
    const message = getErrorMessage(err)
    const status = message.startsWith('Forbidden') || message.startsWith('Invalid transition') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
