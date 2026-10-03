import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminMessagingService, AdminAuditService } from '@/backend/admin'
import { NotificationService } from '@/backend/notifications'

export async function GET(request: NextRequest) {
  const { error } = await requireUserManager()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20') || 20))
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0') || 0)

    const result = await NotificationService.getBroadcasts({ limit, offset })
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[API] GET /admin/broadcasts error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireUserManager()
  if (error) return error

  const body = await request.json()

  if (!body.title || !body.message) {
    return NextResponse.json({ error: 'title and message are required' }, { status: 400 })
  }

  try {
    const result = await AdminMessagingService.sendBroadcast({
      senderId: user.id,
      title: body.title,
      message: body.message,
      targetAudience: body.targetAudience || 'all',
      targetRoles: body.targetRoles,
    })

    if (result.success) {
      await AdminAuditService.log({
        actorId: user.id,
        action: 'broadcast.send',
        targetType: 'broadcast',
        targetId: result.broadcastId,
        details: { title: body.title, targetAudience: body.targetAudience, recipientCount: result.recipientCount },
      })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
