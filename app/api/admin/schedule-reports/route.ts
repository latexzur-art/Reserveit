import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { ScheduleIssueReportsService } from '@/backend/schedule/schedule-issue-reports.service'
import { canTriageScheduleReport } from '@/lib/schedule/report-policy'
import { getErrorMessage } from '@/lib/errors'

const rolesOf = (user: any): string[] => (user?.roles ?? []).map((r: any) => r.name)

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? undefined
    const category = searchParams.get('category') ?? undefined
    const facilityId = searchParams.get('facility_id') ?? undefined
    const isHvac = searchParams.get('is_hvac') === 'true' ? true : undefined
    const isTech = searchParams.get('is_tech') === 'true' ? true : searchParams.get('is_tech') === 'false' ? false : undefined

    const reports = await ScheduleIssueReportsService.listForAdmin(
      status as any,
      { category, facilityId, isHvac, isTech },
    )
    return NextResponse.json({ reports })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
