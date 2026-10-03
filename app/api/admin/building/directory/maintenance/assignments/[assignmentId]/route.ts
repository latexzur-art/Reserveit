import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingDirectoryService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { assignmentId } = await params
    await BuildingDirectoryService.unassignFromFacility(assignmentId)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
