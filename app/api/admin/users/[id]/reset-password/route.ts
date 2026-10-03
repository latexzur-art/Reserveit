import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { AdminAuditService } from '@/backend/admin'
import { createAdminClient } from '@/lib/supabase/server'
import {
  resetEntraUserPassword,
  EntraPermissionError,
} from '@/backend/auth/entra-users.service'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { passwordResetEmail } from '@/backend/notifications/emailTemplates'
import { parseUuidParam } from '@/lib/api/validate-uuid'

function generateTempPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, user } = await requireUserManager()
  if (error) return error

  const { id: rawId } = await params
  const idParsed = parseUuidParam(rawId, 'user id')
  if (!idParsed.ok) return idParsed.response
  const id = idParsed.value

  const supabase = createAdminClient()
  const { data: target, error: dbErr } = await supabase
    .from('users')
    .select('id, auth_user_id, entra_object_id, email, notification_email, full_name, user_type')
    .eq('id', id)
    .single()

  if (dbErr || !target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Handle external user OR user without Entra account
  if (!target.entra_object_id) {
    const authUserId = target.auth_user_id || target.id
    const temporaryPassword = generateTempPassword()

    // 1. Reset password in Supabase Auth
    const { error: authErr } = await supabase.auth.admin.updateUserById(authUserId, {
      password: temporaryPassword,
    })

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 })
    }

    // 2. Set must_change_password = true in public.users
    await supabase
      .from('users')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    // 3. Log Audit
    await AdminAuditService.log({
      actorId: user.id,
      action: 'user.password_reset',
      targetType: 'user',
      targetId: id,
      details: { email: target.email, userType: target.user_type },
    })

    // 4. Send password reset email
    const recipient = target.notification_email || target.email
    let emailSent = false
    if (recipient) {
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('roles!inner(name)')
        .eq('user_id', id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      const rawRole = (roleRow as any)?.roles?.name ?? 'external_client'
      const userRole = rawRole.split('_').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')
      const result = await sendBrevoEmail({
        to: recipient,
        ...passwordResetEmail({
          userName: (target.full_name as string) ?? 'User',
          signInEmail: target.email as string,
          tempPassword: temporaryPassword,
          userRole,
        }),
      })
      emailSent = result.success
    }

    return NextResponse.json({
      success: true,
      temporaryPassword,
      email_sent: emailSent,
      notification_email_used: emailSent ? recipient : null,
    })
  }

  // Handle Entra user reset
  try {
    const { temporaryPassword } = await resetEntraUserPassword(target.entra_object_id)

    // Set must_change_password = true in public.users
    await supabase
      .from('users')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    await AdminAuditService.log({
      actorId: user.id,
      action: 'user.password_reset',
      targetType: 'user',
      targetId: id,
      details: { email: target.email, entraObjectId: target.entra_object_id },
    })

    // Send password email to notification address only — never the Entra/Azure sign-in email
    const notifRecipient = (target.notification_email ?? null) as string | null
    let emailSent = false
    if (!notifRecipient) {
      console.warn(`[reset-password] User ${id} has no notification_email set — password email skipped`)
    } else {
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('roles!inner(name)')
        .eq('user_id', id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      const rawRole = (roleRow as any)?.roles?.name ?? ''
      const userRole = rawRole.split('_').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')
      const result = await sendBrevoEmail({
        to: notifRecipient,
        ...passwordResetEmail({
          userName: (target.full_name as string) ?? 'User',
          signInEmail: target.email as string,
          tempPassword: temporaryPassword,
          userRole,
        }),
      })
      emailSent = result.success
    }

    return NextResponse.json({
      success: true,
      temporaryPassword,
      email_sent: emailSent,
      notification_email_used: emailSent ? notifRecipient : null,
    })
  } catch (err: any) {
    if (err instanceof EntraPermissionError) {
      return NextResponse.json(
        { error: 'Microsoft Graph denied the request — check app permissions.' },
        { status: 403 },
      )
    }
    console.error(`[API] POST /admin/users/${id}/reset-password error:`, err)
    return NextResponse.json(
      { error: err?.message || 'Failed to reset password' },
      { status: 502 },
    )
  }
}
