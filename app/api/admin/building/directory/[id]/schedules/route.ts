import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingDirectoryService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const schedules = await BuildingDirectoryService.getSchedules(id)
    return NextResponse.json({ schedules })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
