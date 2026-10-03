import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'

const idSchema = z.uuid()

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await getAuthUserWithRoles()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid notification id' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('notifications')
    .update({ read: true })
    .eq('id', parsed.data)
    .eq('user_id', user.id)
    .eq('read', false)

  if (error) {
    console.error('[API] PATCH /notifications/[id]/read error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
