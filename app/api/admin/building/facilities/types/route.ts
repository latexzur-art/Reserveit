import { NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFacilitiesService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const types = await BuildingFacilitiesService.getTypes()
    return NextResponse.json({ types })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
