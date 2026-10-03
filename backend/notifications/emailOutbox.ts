/**
 * F5 — Critical email delivery guarantee.
 * Sends via sendBrevoEmail; on a genuine delivery failure (not "skipped" —
 * Brevo simply isn't configured, which a retry can't fix), persists the email to
 * notification_email_outbox so /api/cron/notification-outbox-retry can retry it.
 * Never throws — a failure to queue the retry is logged, not propagated, since
 * callers use this fire-and-forget (`void sendCriticalEmail(...)`).
 * @module backend/notifications/emailOutbox
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendBrevoEmail } from './brevoEmailService'
import type { EmailPayload } from './emailService'

export async function sendCriticalEmail(
  supabase: SupabaseClient,
  payload: EmailPayload,
  meta: { sourceType: string; sourceId?: string }
): Promise<void> {
  const result = await sendBrevoEmail(payload)
  if (result.success || result.skipped) return

  const { error } = await supabase.from('notification_email_outbox').insert({
    to_email: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
    subject: payload.subject,
    html_body: payload.htmlBody,
    source_type: meta.sourceType,
    source_id: meta.sourceId ?? null,
    status: 'pending',
    attempts: 1,
    last_error: result.error,
  })

  if (error) {
    console.error('[emailOutbox] Failed to queue retry for failed send:', error.message)
  }
}
