import { NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingDashboardService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const facilities = await BuildingDashboardService.getFacilityStatusOverview()
    return NextResponse.json({ facilities })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
