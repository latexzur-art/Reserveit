import { NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { BuildingEquipmentService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

const SCOPE = ['it'] as const

export async function GET() {
  const { error: authError } = await requireUserManager()
  if (authError) return authError

  try {
    const [types, statusTypes] = await Promise.all([
      BuildingEquipmentService.getTypes([...SCOPE]),
      BuildingEquipmentService.getStatusTypes(),
    ])
    return NextResponse.json({ types, statusTypes })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { error: authError } = await requireUserManager()
  if (authError) return authError

  try {
    const { name } = await request.json()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const type = await BuildingEquipmentService.createType(name, [...SCOPE])
    return NextResponse.json(type, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
