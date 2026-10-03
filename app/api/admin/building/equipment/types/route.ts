import { NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingEquipmentService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const [types, statusTypes] = await Promise.all([
      BuildingEquipmentService.getTypes(),
      BuildingEquipmentService.getStatusTypes(),
    ])
    return NextResponse.json({ types, statusTypes })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { name } = await request.json()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const type = await BuildingEquipmentService.createType(name)
    return NextResponse.json(type, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
