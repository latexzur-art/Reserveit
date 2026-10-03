import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import {
  sendNotification,
  sendNotificationToRoles,
} from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  scoreResetRequestedEmail,
  scoreResetRequestAcknowledgedEmail,
} from '@/backend/notifications/emailTemplates'
import { RESTRICTION_THRESHOLD } from '@/backend/booking/booking.types'
import { ROUTES } from '@/lib/routes'

const ROLE_LABEL: Record<string, string> = {
  faculty: 'Faculty',
  program_head: 'Program Head',
  teacher: 'Teacher',
  professor: 'Professor',
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  let body: { reason?: string; type?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const reason = (body.reason ?? '').trim()
  const resetType = body.type === 'cancellation_rate' ? 'cancellation_rate' : 'consecutive'
  if (!reason) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
  }
  if (reason.length > 500) {
    return NextResponse.json({ error: 'Reason must be 500 characters or fewer' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('score_reset_requests')
    .select('id')
    .eq('user_id', user!.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'You already have a pending reset request' },
      { status: 409 }
    )
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('full_name, email, notification_email, consecutive_cancellations')
    .eq('id', user!.id)
    .single()

  const count = (userRow?.consecutive_cancellations as number | null) ?? 0
  const requesterName = (userRow?.full_name as string) ?? user!.email ?? 'User'

  const { data: inserted, error: insertError } = await supabase
    .from('score_reset_requests')
    .insert({
      user_id: user!.id,
      count_at_request: count,
      reason,
      reset_type: resetType,
    })
    .select('id, created_at')
    .single()

  if (insertError || !inserted) {
    console.error('[request-reset] insert failed:', insertError?.message)
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
  }

  const userRoles = (user!.roles ?? []) as Array<{ name: string }>
  const primaryRoleName = userRoles[0]?.name ?? ''
  const requesterRole = ROLE_LABEL[primaryRoleName] ?? primaryRoleName ?? 'Teaching Staff'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const reviewUrl = `${appUrl}/admin/building/reliability`

  await sendNotificationToRoles(supabase, ['building_admin'], {
    title: 'Score Reset Request',
    message: `${requesterName} (${requesterRole}) requested a reset of their cancellation counter (${count}/${RESTRICTION_THRESHOLD}). Reason: ${reason}`,
    type: 'info',
    source_type: 'score_reset_request',
    source_id: inserted.id as string,
    priority: 'normal',
    action_url: '/admin/building/reliability',
    metadata: {
      requester_id: user!.id,
      requester_name: requesterName,
      count,
      reason,
    },
  })

  await sendNotification(supabase, {
    user_id: user!.id,
    title: 'Reset Request Submitted',
    message: 'Your reset request has been submitted to the Academic Head for review.',
    type: 'info',
    source_type: 'score_reset_request',
    source_id: inserted.id as string,
    priority: 'normal',
  })

  void (async () => {
    try {
      const { data: heads } = await supabase
        .from('user_roles')
        .select('user_id, roles!inner(name)')
        .in('roles.name', ['building_admin'])
        .eq('is_active', true)

      if (heads && heads.length > 0) {
        const ids = [...new Set((heads as Array<{ user_id: string }>).map((r) => r.user_id))]
        const { data: headRows } = await supabase
          .from('users')
          .select('id, full_name, notification_email')
          .in('id', ids)

        for (const head of (headRows ?? []) as Array<{
          id: string
          full_name: string | null
          notification_email: string | null
        }>) {
          if (!head.notification_email) continue
          void sendBrevoEmail({
            to: head.notification_email,
            ...scoreResetRequestedEmail({
              requesterName,
              requesterRole,
              count,
              threshold: RESTRICTION_THRESHOLD,
              reason,
              reviewUrl,
            }),
          }).catch((err) =>
            console.error('[request-reset] head email failed:', err instanceof Error ? err.message : err)
          )
        }
      }

      const requesterRecipient = (userRow?.notification_email as string | null) ?? null
      if (requesterRecipient) {
        void sendBrevoEmail({
          to: requesterRecipient,
          ...scoreResetRequestAcknowledgedEmail({ userName: requesterName }),
        }).catch((err) =>
          console.error('[request-reset] ack email failed:', err instanceof Error ? err.message : err)
        )
      }
    } catch (emailErr) {
      console.error('[request-reset] email block failed:', emailErr instanceof Error ? emailErr.message : emailErr)
    }
  })()

  return NextResponse.json({
    success: true,
    requestId: inserted.id,
    createdAt: inserted.created_at,
  })
}
