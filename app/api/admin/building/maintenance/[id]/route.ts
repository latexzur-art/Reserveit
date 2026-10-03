import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingMaintenanceService } from '@/backend/admin/building'
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
    const record = await BuildingMaintenanceService.update(id, body)
    return NextResponse.json(record)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
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
    await BuildingMaintenanceService.delete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
