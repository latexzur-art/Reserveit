import { NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { BuildingEquipmentService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error: authError } = await requireUserManager()
  if (authError) return authError

  try {
    const stats = await BuildingEquipmentService.getStats(['it'])
    return NextResponse.json(stats)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
