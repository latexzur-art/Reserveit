/**
 * POST /api/admin/booking-rules/reload
 *
 * F14 — `booking:hard_rules` and `booking:soft_rules` (approval_constraint_rules,
 * see hardConstraintChecker.ts / softScoringEngine.ts) are cached for 24h with no
 * write-path invalidation, unlike `booking:active_term*` which the academic-terms
 * admin routes correctly bust on every edit. `approval_constraint_rules` has no
 * app-level write route today (edited directly in the DB/Supabase dashboard), so
 * there's nothing to hook a cacheDelete() call into. This endpoint is the manual
 * escape hatch: an admin who just edited a rule (toggled is_active, changed
 * point_value, added a rule) calls this to make it take effect immediately instead
 * of waiting up to 24h for the cache to expire.
 *
 * If a proper admin UI/route for approval_constraint_rules is ever built, call
 * cacheDelete('booking:hard_rules') / cacheDelete('booking:soft_rules') directly
 * from its write path (mirroring the academic-terms pattern) instead of relying on
 * this manual endpoint.
 */
import { NextResponse } from 'next/server'
import { requireBuildingAdmin } from '@/lib/auth/guards'
import { cacheDelete } from '@/lib/cache'

export async function POST() {
  const { error } = await requireBuildingAdmin()
  if (error) return error

  cacheDelete('booking:hard_rules')
  cacheDelete('booking:soft_rules')

  return NextResponse.json({ status: 'ok', cleared: ['booking:hard_rules', 'booking:soft_rules'] })
}
