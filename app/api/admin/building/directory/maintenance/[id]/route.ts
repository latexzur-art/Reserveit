import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingDirectoryService } from '@/backend/admin/building'
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
    const staff = await BuildingDirectoryService.updateMaintenanceStaff(id, {
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      position: body.position,
      specialization: body.specialization,
      hireDate: body.hireDate,
      notes: body.notes,
    })
    return NextResponse.json(staff)
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
    await BuildingDirectoryService.deactivateMaintenanceStaff(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
