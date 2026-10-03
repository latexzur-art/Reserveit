import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminMessagingService, AdminAuditService } from '@/backend/admin'

export async function POST(request: NextRequest) {
  const { error, user } = await requireUserManager()
  if (error) return error

  const body = await request.json()

  if (!body.recipientId || !body.subject || !body.body) {
    return NextResponse.json({ error: 'recipientId, subject, and body are required' }, { status: 400 })
  }

  try {
    const result = await AdminMessagingService.sendMessage({
      senderId: user.id,
      recipientId: body.recipientId,
      subject: body.subject,
      body: body.body,
      sendAs: body.sendAs || 'both',
    })

    if (result.success) {
      await AdminAuditService.log({
        actorId: user.id,
        action: 'message.send',
        targetType: 'message',
        targetId: result.messageId,
        details: { recipientId: body.recipientId, subject: body.subject },
      })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
