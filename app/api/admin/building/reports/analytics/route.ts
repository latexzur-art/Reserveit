import { NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingReportsService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const analytics = await BuildingReportsService.getAnalyticsBundle()
    return NextResponse.json({ analytics })
  } catch (err) {
    console.error('[API] GET /admin/building/reports/analytics error:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
