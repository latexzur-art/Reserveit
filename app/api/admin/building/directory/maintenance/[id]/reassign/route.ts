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
    const { fromFacilityId, toFacilityId } = body
    if (!fromFacilityId || !toFacilityId) {
      return NextResponse.json({ error: 'fromFacilityId and toFacilityId required' }, { status: 400 })
    }
    const assignment = await BuildingDirectoryService.reassignFacility(id, fromFacilityId, toFacilityId, (user?.authUserId as string) ?? null)
    return NextResponse.json(assignment)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
