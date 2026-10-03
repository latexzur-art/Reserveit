import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { ScheduleIssueReportsService } from '@/backend/schedule/schedule-issue-reports.service'
import { getErrorMessage } from '@/lib/errors'

const PatchSchema = z.object({
  what_to_correct: z.string().max(2000).optional(),
  retract: z.boolean().optional(),
})

/**
 * PATCH — self-service update by the report owner.
 *
 * Allowed:
 *   - Adding / editing `what_to_correct` details
 *   - Retracting the report (status → dismissed)
 *
 * NOT allowed (that's admin-only):
 *   - Changing category, schedule_id
 *   - Escalating
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join('; ') },
      { status: 400 },
    )
  }

  try {
    const report = await ScheduleIssueReportsService.updateSelf(id, user!.id, {
      whatToCorrect: parsed.data.what_to_correct,
      retract: parsed.data.retract,
    })
    return NextResponse.json(report)
  } catch (err) {
    const msg = getErrorMessage(err)
    if (msg.includes('not found')) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }
    if (msg.includes('own reports') || msg.includes('can only edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (msg.includes('No changes')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    if (msg.includes('retracted')) {
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
