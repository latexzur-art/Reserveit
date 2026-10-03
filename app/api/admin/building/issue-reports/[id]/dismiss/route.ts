import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiUnexpectedError } from '@/lib/api/response'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const report = await BuildingFacilityEnhancementService.dismissIssueReport(id)
    return NextResponse.json(report)
  } catch (err) {
    return apiUnexpectedError('PATCH /api/admin/building/issue-reports/[id]/dismiss', err)
  }
}
