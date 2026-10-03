import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'

export async function DELETE() {
  const { user } = await getAuthUserWithRoles()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('notifications')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    console.error('[API] DELETE /notifications error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest) {
  const { user } = await getAuthUserWithRoles()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread_only') === 'true'
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20') || 20))
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0') || 0)

  const adminClient = createAdminClient()

  let query = adminClient
    .from('notifications')
    .select('id, title, message, type, read, source_type, source_id, priority, action_url, metadata, is_broadcast, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (unreadOnly) {
    query = query.eq('read', false)
  }

  const { data: notifications, count, error } = await query

  if (error) {
    console.error('[API] GET /notifications error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { count: unreadCount } = await adminClient
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false)

  return NextResponse.json({
    notifications: notifications ?? [],
    total: count ?? 0,
    unread_count: unreadCount ?? 0,
  })
}
