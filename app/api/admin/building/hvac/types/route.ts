import { NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingEquipmentService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const [types, statusTypes] = await Promise.all([
      BuildingEquipmentService.getTypes(['building']),
      BuildingEquipmentService.getStatusTypes(),
    ])
    return NextResponse.json({ types, statusTypes })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
