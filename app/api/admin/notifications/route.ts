import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { NotificationService } from '@/backend/notifications'

export async function GET(request: NextRequest) {
  const { error, user } = await requireUserManager()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread_only') === 'true'
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20') || 20))
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0') || 0)

    const result = await NotificationService.getUserNotifications(user.id, {
      limit,
      offset,
      unreadOnly,
    })
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[API] GET /admin/notifications error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await requireUserManager()
  if (error) return error

  try {
    const body = await request.json()

    if (body.action === 'mark_all_read') {
      await NotificationService.markAllRead(user.id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    console.error('[API] PATCH /admin/notifications error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error, user } = await requireUserManager()
  if (error) return error

  try {
    await NotificationService.deleteAll(user.id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API] DELETE /admin/notifications error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
