import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { DataWipeService } from '@/backend/admin'
import { AdminAuditService } from '@/backend/admin'
import { checkDataWipeAllowed } from '@/lib/env/data-wipe'
import { parseBody } from '@/lib/api/validate'
import { apiError, apiUnexpectedError } from '@/lib/api/response'

const TIERS = ['bookings', 'schedules', 'curriculum', 'all'] as const

const WipeSchema = z.object({
  tier: z.enum(TIERS),
  // Must match "WIPE <TIER>" exactly, e.g. "WIPE ALL" — guards against accidents.
  confirm: z.string(),
})

/** GET: environment gate + dry-run counts for the preview UI. */
export async function GET() {
  const { error } = await requireBuildingAdminStrict()
  if (error) return error

  const gate = checkDataWipeAllowed()
  if (!gate.allowed) {
    return NextResponse.json({ allowed: false, reason: gate.reason, counts: null })
  }

  try {
    const counts = await DataWipeService.dataCounts()
    return NextResponse.json({ allowed: true, counts })
  } catch (err) {
    return apiUnexpectedError('GET /api/admin/building/data-wipe', err)
  }
}

/** POST: execute a tier wipe. */
export async function POST(request: NextRequest) {
  const { error, user } = await requireBuildingAdminStrict()
  if (error) return error

  const gate = checkDataWipeAllowed()
  if (!gate.allowed) return apiError(403, gate.reason)

  const parsed = await parseBody(request, WipeSchema)
  if (!parsed.ok) return parsed.response
  const { tier, confirm } = parsed.data

  const expected = `WIPE ${tier.toUpperCase()}`
  if (confirm.trim() !== expected) {
    return apiError(400, `Confirmation phrase must be exactly "${expected}".`)
  }

  try {
    const result = await DataWipeService.wipeData(tier)

    await AdminAuditService.log({
      actorId: user.id,
      action: 'data.wipe',
      targetType: 'data_tier',
      details: { tier, deleted: result.deleted },
    })

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    return apiUnexpectedError('POST /api/admin/building/data-wipe', err)
  }
}
