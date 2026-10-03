import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { NotificationService } from '@/backend/notifications'

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUserWithRoles()

  if (!user) {
    return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const reason: string = (body?.reason ?? '').trim()

  const roleDisplay = user.roles?.length
    ? user.roles.map((r: { displayName: string }) => r.displayName).join(', ')
    : 'Unknown'

  const message =
    `${user.full_name} (${user.email}) has requested a password reset. ` +
    `Role: ${roleDisplay}. ` +
    `Reason: ${reason || 'No reason provided'}`

  const sent = await NotificationService.createForRoles(['it_admin'], {
    title: 'Password Reset Request',
    message,
    type: 'warning',
    priority: 'high',
    action_url: '/admin/users',
    source_type: 'password_reset_request',
  })

  if (sent === 0) {
    return NextResponse.json(
      { error: 'No IT Admin found to notify. Please contact your administrator directly.' },
      { status: 503 }
    )
  }

  return NextResponse.json({ success: true })
}
