import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiUnexpectedError } from '@/lib/api/response'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const report = await BuildingFacilityEnhancementService.convertIssueToMaintenance(id, user.id)
    return NextResponse.json(report)
  } catch (err) {
    return apiUnexpectedError('POST /api/admin/building/issue-reports/[id]/convert', err)
  }
}
