/**
 * Reliability score service
 *
 * Centralizes the logic for resetting a user's consecutive_cancellations counter,
 * writing an audit entry to restriction_logs, and notifying the user in-app + email.
 * Consumed by:
 *   - app/api/academic-head/reliability/[userId]/reset
 *   - app/api/academic-head/reliability/bulk-reset
 *   - app/api/academic-head/reliability/requests/[requestId]/decision (approve path)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  scoreResetApprovedEmail,
  scoreResetByAcademicHeadEmail,
} from '@/backend/notifications/emailTemplates'
import { RESTRICTION_THRESHOLD } from '@/backend/booking/booking.types'

export { RESTRICTION_THRESHOLD }

export type ResetSource = 'manual' | 'request' | 'bulk'

interface ResetOptions {
  actorId: string
  actorName: string
  source: ResetSource
  notes?: string
  /** Skip the per-user email (used for bulk to avoid mail storms). */
  skipEmail?: boolean
  /**
   * When true, skip the early-return guard so the 90-day cancellation-rate
   * window is cleared even for users whose consecutive counter is already 0.
   * Use this when handling a 'cancellation_rate' reset request.
   */
  forceReset?: boolean
}

interface ResetResult {
  userId: string
  previousCount: number
  previousStatus: string | null
  newStatus: string | null
  changed: boolean
}

/**
 * Reset one user's consecutive_cancellations counter to 0.
 * If the user is currently `restricted` AND the restriction was caused by cancellations
 * (i.e. count >= RESTRICTION_THRESHOLD), also move them back to `active`.
 * Other restriction reasons are left untouched.
 */
export async function resetUserScore(
  supabase: SupabaseClient,
  userId: string,
  opts: ResetOptions
): Promise<ResetResult> {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, full_name, email, notification_email, consecutive_cancellations, account_status')
    .eq('id', userId)
    .single()

  if (fetchError || !user) {
    throw new Error(`User ${userId} not found`)
  }

  const previousCount = (user.consecutive_cancellations as number | null) ?? 0
  const previousStatus = (user.account_status as string | null) ?? null

  if (!opts.forceReset && previousCount === 0 && previousStatus !== 'restricted') {
    return { userId, previousCount, previousStatus, newStatus: previousStatus, changed: false }
  }

  const wasCancellationRestricted =
    previousStatus === 'restricted' && previousCount >= RESTRICTION_THRESHOLD
  const newStatus = wasCancellationRestricted ? 'active' : previousStatus

  const now = new Date().toISOString()
  const updatePatch: Record<string, unknown> = {
    consecutive_cancellations: 0,
    updated_at: now,
  }
  if (wasCancellationRestricted) {
    updatePatch.account_status = 'active'
    updatePatch.restriction_lifted_by = opts.actorId
    updatePatch.restriction_lifted_at = now
  }

  const { error: updateError } = await supabase
    .from('users')
    .update(updatePatch)
    .eq('id', userId)
  if (updateError) throw updateError

  // Also clear the cancellation-rate window: mark recent user-initiated cancellations
  // as admin_cancelled so the scoring engine's 90-day rate drops to 0.
  const windowStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('bookings')
    .update({ cancellation_type: 'admin_cancelled' })
    .eq('user_id', userId)
    .in('current_status', ['cancelled', 'auto_declined'])
    .neq('cancellation_type', 'admin_cancelled')
    .gte('created_at', windowStart)

  await supabase.from('restriction_logs').insert({
    user_id: userId,
    action: opts.source === 'bulk' ? 'score_reset_bulk' : 'score_reset',
    actor_id: opts.actorId,
    cancellation_count: previousCount,
    reason:
      opts.notes ??
      (opts.source === 'request'
        ? 'Reset approved by Academic Head'
        : opts.source === 'bulk'
          ? 'Bulk reset by Academic Head'
          : 'Reset by Academic Head'),
  })

  const notifTitle =
    opts.source === 'request'
      ? 'Reset Request Approved'
      : 'Reliability Score Reset'
  const notifMessage =
    opts.source === 'request'
      ? 'Your reset request has been approved. Your cancellation counter is now 0.'
      : 'Your consecutive-cancellations counter has been reset to 0 by the Academic Head.'

  await sendNotification(supabase, {
    user_id: userId,
    title: notifTitle,
    message: notifMessage,
    type: 'success',
    source_type: 'score_reset',
    source_id: userId,
    priority: 'normal',
    metadata: { source: opts.source, previous_count: previousCount, notes: opts.notes ?? null },
  })

  if (!opts.skipEmail) {
    const recipient = ((user as { notification_email?: string | null }).notification_email) ?? null
    if (recipient) {
      const template =
        opts.source === 'request' ? scoreResetApprovedEmail : scoreResetByAcademicHeadEmail
      void sendBrevoEmail({
        to: recipient,
        ...template({
          userName: (user.full_name as string) ?? 'User',
          decidedBy: opts.actorName,
          notes: opts.notes,
        }),
      }).catch((err) =>
        console.error('[reliability.service] reset email failed:', err instanceof Error ? err.message : err)
      )
    }
  }

  return { userId, previousCount, previousStatus, newStatus, changed: true }
}
