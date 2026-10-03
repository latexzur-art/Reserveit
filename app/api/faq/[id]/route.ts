import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingFAQService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()
    const item = await BuildingFAQService.update(id, body)
    return NextResponse.json(item)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    await BuildingFAQService.delete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
