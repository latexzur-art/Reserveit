import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { ScheduleIssueReportsService } from '@/backend/schedule/schedule-issue-reports.service'
import { getErrorMessage } from '@/lib/errors'
import { checkRateLimitAsync } from '@/lib/rate-limit'

export async function GET() {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const reports = await ScheduleIssueReportsService.listForUser(user!.id)
    return NextResponse.json({ reports })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  // Rate limit: 10 reports per minute per user
  const rateLimitResponse = await checkRateLimitAsync(
    `schedule-report:${user!.id}`,
    { maxRequests: 10, windowMs: 60_000 },
  )
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    if (!body?.category || !body?.what_happened) {
      return NextResponse.json(
        { error: 'category and what_happened are required' },
        { status: 400 },
      )
    }

    const report = await ScheduleIssueReportsService.create({
      scheduleType: body.schedule_type,
      scheduleId: body.schedule_id,
      facilityId: body.facility_id ?? null,
      facilityName: body.facility_name ?? null,
      courseCode: body.course_code ?? null,
      section: body.section ?? null,
      scheduleDate: body.schedule_date ?? null,
      startTime: body.start_time ?? null,
      endTime: body.end_time ?? null,
      dayOfWeek: body.day_of_week ?? null,
      category: body.category,
      noticedAt: body.noticed_at,
      whatHappened: body.what_happened,
      whatToCorrect: body.what_to_correct ?? null,
      equipmentType: body.equipment_type,
      isTech: body.is_tech ?? null,
      isHvac: body.is_hvac ?? null,
      reportedBy: user!.id,
    })
    return NextResponse.json(report, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
