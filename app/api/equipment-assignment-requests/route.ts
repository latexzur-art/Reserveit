import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser, requireBuildingAdminStrict } from '@/lib/auth/guards'
import { EquipmentAssignmentRequestsService } from '@/backend/equipment/assignment-requests.service'
import { getErrorMessage } from '@/lib/errors'

const rolesOf = (user: any): string[] => (user?.roles ?? []).map((r: any) => r.name)

export async function GET() {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const requests = await EquipmentAssignmentRequestsService.list({
      userId: user!.id,
      roles: rolesOf(user),
    })
    return NextResponse.json({ requests })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const body = await request.json()
    if (!body?.equipmentId || !body?.toFacilityId) {
      return NextResponse.json({ error: 'equipmentId and toFacilityId are required' }, { status: 400 })
    }
    const req = await EquipmentAssignmentRequestsService.create({
      equipmentId: body.equipmentId,
      toFacilityId: body.toFacilityId,
      reason: body.reason ?? null,
      requestedByUserId: user!.id,
    })
    return NextResponse.json(req, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
