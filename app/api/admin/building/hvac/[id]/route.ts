import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingEquipmentService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

const SCOPE = ['building'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()
    const equipment = await BuildingEquipmentService.update(id, body, [...SCOPE])
    return NextResponse.json(equipment)
  } catch (err) {
    const message = getErrorMessage(err)
    const status = message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    await BuildingEquipmentService.delete(id, [...SCOPE])
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = getErrorMessage(err)
    const status = message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
