import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingDirectoryService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()
    const facilityIds: string[] = body.facilityIds ?? []
    if (!facilityIds.length) {
      return NextResponse.json({ error: 'facilityIds required' }, { status: 400 })
    }
    const assignments = await BuildingDirectoryService.assignToFacilities(id, facilityIds, (user?.authUserId as string) ?? null)
    return NextResponse.json({ assignments }, { status: 201 })
  } catch (err) {
    const msg = getErrorMessage(err)
    const status = msg.includes('duplicate') || msg.includes('unique') ? 409 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
