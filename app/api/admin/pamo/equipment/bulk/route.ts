import { NextResponse, type NextRequest } from 'next/server'
import { requirePamo } from '@/lib/auth/guards'
import { BuildingEquipmentService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

const SCOPE = ['pamo'] as const

export async function POST(request: NextRequest) {
  const { error: authError } = await requirePamo()
  if (authError) return authError

  try {
    const { items } = await request.json()
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 })
    }
    const count = await BuildingEquipmentService.importBulk(items, [...SCOPE])
    return NextResponse.json({ success: true, count })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error: authError } = await requirePamo()
  if (authError) return authError

  try {
    const { ids, filters } = await request.json()
    if ((!ids || !Array.isArray(ids)) && !filters) {
      return NextResponse.json({ error: 'Invalid request: provide ids or filters' }, { status: 400 })
    }
    await BuildingEquipmentService.deleteBulk(ids, filters, [...SCOPE])
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error: authError } = await requirePamo()
  if (authError) return authError

  try {
    const { ids, updates, filters } = await request.json()
    if (((!ids || !Array.isArray(ids)) && !filters) || !updates) {
      return NextResponse.json({ error: 'Invalid request: provide ids/filters and updates' }, { status: 400 })
    }
    await BuildingEquipmentService.updateBulk(updates, ids, filters, [...SCOPE])
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
