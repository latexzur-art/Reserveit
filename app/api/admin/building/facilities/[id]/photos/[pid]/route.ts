import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { BuildingFacilityEnhancementService } from '@/backend/admin/building'
import { apiUnexpectedError } from '@/lib/api/response'

const BUCKET = 'facility-photos'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { pid } = await params
    const body = await request.json()
    const photo = await BuildingFacilityEnhancementService.updatePhoto(pid, {
      caption: body.caption,
      isCover: body.isCover,
      sortOrder: body.sortOrder,
    })
    return NextResponse.json(photo)
  } catch (err) {
    return apiUnexpectedError('PATCH /api/admin/building/facilities/[id]/photos/[pid]', err)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { pid } = await params
    const deleted = await BuildingFacilityEnhancementService.deletePhoto(pid)

    if (deleted?.storage_path) {
      const supabase = createAdminClient()
      await supabase.storage.from(BUCKET).remove([deleted.storage_path])
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return apiUnexpectedError('DELETE /api/admin/building/facilities/[id]/photos/[pid]', err)
  }
}
