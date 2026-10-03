import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { accountProbationEmail, accountRestrictedEmail } from '@/backend/notifications/emailTemplates'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user: admin } = await requireBuildingAdminStrict()
  if (error) return error

  const { id: targetUserId } = await params

  let body: { status?: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const newStatus = body.status
  if (newStatus !== 'probation' && newStatus !== 'restricted') {
    return NextResponse.json(
      { error: 'status must be "probation" or "restricted"' },
      { status: 400 }
    )
  }

  const reason = (body.reason ?? '').trim()
  if (!reason) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: targetUser, error: fetchError } = await supabase
    .from('users')
    .select('id, full_name, email, notification_email, account_status, consecutive_cancellations')
    .eq('id', targetUserId)
    .single()

  if (fetchError || !targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (targetUser.account_status === newStatus) {
    return NextResponse.json(
      { error: `User is already ${newStatus}` },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()
  const adminName = (admin!.full_name as string | null) ?? 'Building Admin'

  const patch: Record<string, unknown> = {
    account_status: newStatus,
    restricted_reason: reason,
    updated_at: now,
  }

  if (newStatus === 'restricted') {
    patch.restricted_at = now
    patch.restriction_lifted_by = null
    patch.restriction_lifted_at = null
  } else {
    patch.probation_started_at = now
    patch.probation_lifted_at = null
  }

  const { error: updateError } = await supabase
    .from('users')
    .update(patch)
    .eq('id', targetUserId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await supabase.from('restriction_logs').insert({
    user_id: targetUserId,
    action: newStatus === 'restricted' ? 'manually_restricted' : 'probation_started',
    actor_id: admin!.id,
    cancellation_count: (targetUser.consecutive_cancellations as number | null) ?? 0,
    reason,
  })

  const notifTitle = newStatus === 'restricted' ? 'Account Restricted' : 'Account Placed on Probation'
  const notifMessage =
    newStatus === 'restricted'
      ? `Your account has been restricted by the Building Admin. All booking requests are currently blocked. Reason: ${reason}`
      : `Your account has been placed on probation by the Building Admin. All bookings will require manual approval. Reason: ${reason}`

  await sendNotification(supabase, {
    user_id: targetUserId,
    title: notifTitle,
    message: notifMessage,
    type: 'warning',
    source_type: 'user',
    source_id: targetUserId,
    priority: 'high',
  })

  const recipient = (targetUser.notification_email as string | null) ?? null
  if (!recipient) {
    console.warn(`[enforce] User ${targetUserId} has no notification_email set — enforcement email skipped`)
  } else {
    const userName = (targetUser.full_name as string | null) ?? 'User'
    const emailTemplate =
      newStatus === 'restricted'
        ? accountRestrictedEmail({ userName, adminName, reason })
        : accountProbationEmail({ userName, adminName, reason })
    void sendBrevoEmail({ to: recipient, ...emailTemplate }).catch((err) =>
      console.error('[enforce] email failed:', err instanceof Error ? err.message : err)
    )
  }

  return NextResponse.json({
    success: true,
    message: `${targetUser.full_name as string} has been set to ${newStatus}.`,
  })
}
