import { NextRequest, NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { NotificationService } from '@/backend/notifications'

export async function PATCH(request: NextRequest) {
  const { error, user } = await requireBuildingAdminStrict()
  if (error) return error

  try {
    const body = await request.json()

    if (body.action === 'mark_all_read') {
      await NotificationService.markAllRead(user.id)
      return NextResponse.json({ success: true })
    }

    if (body.action === 'mark_read' && body.id) {
      await NotificationService.markRead(body.id, user.id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    console.error('[API] PATCH /admin/building/notifications error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { error, user } = await requireBuildingAdminStrict()
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

    const notifications = result.notifications.map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      created_at: n.created_at,
      source_type: n.source_type,
      source_id: n.source_id,
      priority: n.priority ?? 'normal',
      action_url: n.action_url ?? null,
      metadata: n.metadata ?? null,
      is_broadcast: n.is_broadcast ?? false,
    }))

    return NextResponse.json({
      notifications,
      total: result.total,
      unreadCount: result.unread_count,
    })
  } catch (err: any) {
    console.error('[API] GET /admin/building/notifications error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
