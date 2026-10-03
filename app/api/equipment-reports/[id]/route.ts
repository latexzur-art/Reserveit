import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { EquipmentIssueReportsService } from '@/backend/equipment/issue-reports.service'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'

const rolesOf = (user: any): string[] => (user?.roles ?? []).map((r: any) => r.name)

const Schema = z.object({
  status: z.enum(['open', 'under_process', 'resolved', 'still_broken', 'escalated']),
  resolutionNotes: z.string().max(2000).nullish(),
  isTech: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const { id: rawId } = await params
    const idParsed = parseUuidParam(rawId, 'report id')
    if (!idParsed.ok) return idParsed.response

    const parsed = Schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
    }

    const report = await EquipmentIssueReportsService.updateStatus(idParsed.value, {
      status: parsed.data.status,
      resolutionNotes: parsed.data.resolutionNotes,
      handledByUserId: user!.id,
      roles: rolesOf(user),
      isTech: parsed.data.isTech,
    })
    return NextResponse.json(report)
  } catch (err) {
    const message = getErrorMessage(err)
    const status = message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
