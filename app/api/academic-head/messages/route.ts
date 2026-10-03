import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHead } from '@/lib/auth/guards'
import { AdminMessagingService } from '@/backend/admin'

export async function GET(request: NextRequest) {
  const { error, user } = await requireAcademicHead()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20') || 20))
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0') || 0)

    const supabase = createAdminClient()

    // Get messages where user is sender or recipient
    const { data, count, error: dbError } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, subject, body, status, sent_at, created_at, sender:users!messages_sender_id_fkey(id, full_name), recipient:users!messages_recipient_id_fkey(id, full_name)', { count: 'exact' })
      .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (dbError) throw new Error(dbError.message)

    const messages = (data ?? []).map((m: any) => {
      const isSender = m.sender_id === user!.id
      return {
        id: m.id,
        senderId: m.sender_id,
        senderName: m.sender?.full_name ?? 'Unknown',
        recipientId: m.recipient_id,
        recipientName: m.recipient?.full_name ?? 'Unknown',
        subject: m.subject,
        content: m.body,
        status: m.status,
        isMine: isSender,
        createdAt: m.created_at,
      }
    })

    return NextResponse.json({ messages, total: count ?? 0 })
  } catch (err: any) {
    console.error('[API] GET /academic-head/messages error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAcademicHead()
  if (error) return error

  try {
    const body = await request.json()

    if (!body.recipientId || !body.subject || !body.body) {
      return NextResponse.json({ error: 'recipientId, subject, and body are required' }, { status: 400 })
    }

    const result = await AdminMessagingService.sendMessage({
      senderId: user!.id,
      recipientId: body.recipientId,
      subject: body.subject,
      body: body.body,
      sendAs: body.sendAs || 'in-app',
    })

    if (!result.success) {
      return NextResponse.json({ error: (result as any).error ?? 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: result.messageId })
  } catch (err: any) {
    console.error('[API] POST /academic-head/messages error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

