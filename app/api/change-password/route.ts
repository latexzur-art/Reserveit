import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUserWithRoles()

  if (!user) {
    return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password are required.' }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 })
  }

  // Verify current password using a stateless anon client (no cookie side-effects)
  const verifyClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  const { error: signInError } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (signInError) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
  }

  // Update password via admin client
  const adminClient = createAdminClient()
  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    user.auth_user_id as string,
    { password: newPassword }
  )

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update password. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
