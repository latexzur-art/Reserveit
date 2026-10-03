import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiUnexpectedError } from '@/lib/api/response'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; wid: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { wid } = await params
    const body = await request.json()
    const warning = await BuildingFacilityEnhancementService.updateWarning(wid, {
      isActive: body.isActive,
      severity: body.severity,
      message: body.message,
    })
    return NextResponse.json(warning)
  } catch (err) {
    return apiUnexpectedError('PATCH /api/admin/building/facilities/[id]/warnings/[wid]', err)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; wid: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { wid } = await params
    await BuildingFacilityEnhancementService.deleteWarning(wid)
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiUnexpectedError('DELETE /api/admin/building/facilities/[id]/warnings/[wid]', err)
  }
}
