import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { ScheduleIssueReportsService } from '@/backend/schedule/schedule-issue-reports.service'
import { canTriageScheduleReport } from '@/lib/schedule/report-policy'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'

const rolesOf = (user: any): string[] => (user?.roles ?? []).map((r: any) => r.name)

const Schema = z.object({
  equipmentId: z.string().uuid().optional(),
  facilityId: z.string().uuid(),
  category: z.enum(['broken', 'missing', 'malfunction', 'other']),
  description: z.string().min(1).max(2000),
  isTech: z.boolean().optional(),
})

export async function POST(
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

    // Determine isTech: prefer equipment lookup, fallback to body value
    let isTech = parsed.data.isTech ?? false
    if (parsed.data.equipmentId) {
      const { createAdminClient } = await import('@/lib/supabase/server')
      const supabase = createAdminClient()
      const { data: eq } = await supabase
        .from('equipment')
        .select('equipment_type:equipment_types!equipment_equipment_type_id_fkey(managed_by)')
        .eq('id', parsed.data.equipmentId)
        .single()
      isTech = (eq?.equipment_type as any)?.managed_by === 'it'
    }

    const report = await ScheduleIssueReportsService.escalate(idParsed.value, {
      isTech,
      escalatedBy: user!.id,
    })
    return NextResponse.json(report, { status: 201 })
  } catch (err) {
    const message = getErrorMessage(err)
    const status = message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
