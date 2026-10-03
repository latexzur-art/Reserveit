import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingEquipmentService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { searchParams } = request.nextUrl
    // Ownership scope filter (tech vs non-tech vs building fixtures). The service
    // takes an array of managed_by values; a single UI selection maps to one.
    const scope = searchParams.get('scope')
    const managedBy =
      scope && scope !== 'all' && ['pamo', 'it', 'building'].includes(scope)
        ? [scope as 'pamo' | 'it' | 'building']
        : undefined
    const result = await BuildingEquipmentService.getAll({
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
      status: searchParams.get('status') || undefined,
      managedBy,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '50'),
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const body = await request.json()
    // Building Admin may only create building-scope fixtures (HVAC). Non-tech is
    // owned by PAMO, tech by IT Admin.
    const equipment = await BuildingEquipmentService.create(body, ['building'])
    return NextResponse.json(equipment, { status: 201 })
  } catch (err) {
    const message = getErrorMessage(err)
    const status = message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
