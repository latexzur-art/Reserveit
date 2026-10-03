import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiUnexpectedError } from '@/lib/api/response'

export async function GET(_request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const reports = await BuildingFacilityEnhancementService.listOpenIssueReports()
    return NextResponse.json({ reports })
  } catch (err) {
    return apiUnexpectedError('GET /api/admin/building/issue-reports', err)
  }
}
