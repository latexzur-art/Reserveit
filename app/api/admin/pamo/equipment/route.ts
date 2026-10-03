import { NextResponse, type NextRequest } from 'next/server'
import { requirePamo } from '@/lib/auth/guards'
import { BuildingEquipmentService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

const SCOPE = ['pamo'] as const

export async function GET(request: NextRequest) {
  const { error: authError } = await requirePamo()
  if (authError) return authError

  try {
    const { searchParams } = request.nextUrl
    const result = await BuildingEquipmentService.getAll({
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
      status: searchParams.get('status') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '50'),
      managedBy: [...SCOPE],
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requirePamo()
  if (authError) return authError

  try {
    const body = await request.json()
    const equipment = await BuildingEquipmentService.create(body, [...SCOPE])
    return NextResponse.json(equipment, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
