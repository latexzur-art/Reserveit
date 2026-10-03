import { NextResponse, type NextRequest } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { BuildingBookingsService } from '@/backend/admin/building'
import { getErrorMessage } from '@/lib/errors'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const booking = await BuildingBookingsService.getById(id)
    return NextResponse.json(booking)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()
    const { action, notes } = body

    let result
    if (action === 'approve') {
      result = await BuildingBookingsService.approve(id, notes)
    } else if (action === 'reject') {
      result = await BuildingBookingsService.reject(id, notes)
    } else if (action === 'cancel') {
      result = await BuildingBookingsService.cancel(id, notes, user!.id)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err) {
    const msg = getErrorMessage(err)
    if (
      msg.includes('Cannot approve') ||
      msg.includes('Cannot reject') ||
      msg.includes('Cannot cancel') ||
      msg.includes('already processed') ||
      msg.includes('not found')
    ) {
      const status = msg.includes('not found') ? 44 : 400
      return NextResponse.json({ error: msg }, { status: status === 44 ? 404 : 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
