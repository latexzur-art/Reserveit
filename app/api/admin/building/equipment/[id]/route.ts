import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingEquipmentService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()
    // Building Admin edits are limited to building-scope fixtures (HVAC).
    const equipment = await BuildingEquipmentService.update(id, body, ['building'])
    return NextResponse.json(equipment)
  } catch (err) {
    const message = getErrorMessage(err)
    const status = message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    await BuildingEquipmentService.delete(id, ['building'])
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = getErrorMessage(err)
    const status = message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
