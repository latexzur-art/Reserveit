import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingDirectoryService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const body = await request.json()
    const staff = await BuildingDirectoryService.createMaintenanceStaff({
      fullName: body.fullName,
      email: body.email ?? null,
      phone: body.phone ?? null,
      position: body.position ?? 'Maintenance Technician',
      specialization: body.specialization ?? null,
      hireDate: body.hireDate ?? null,
      notes: body.notes ?? null,
      createdBy: (user?.authUserId as string) ?? null,
    })
    return NextResponse.json(staff, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
