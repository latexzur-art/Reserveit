/**
 * GET /api/cron/notification-outbox-retry
 *
 * F5 — retries critical booking-decision emails that failed to send via Brevo (see
 * backend/notifications/emailOutbox.ts and supabase/migrations/20260731150000_email_outbox.sql).
 * Dead-letters (marks 'failed', stops retrying, logs for a human) a row once it has
 * exhausted MAX_ATTEMPTS — same poison-pill shape as the booking-pipeline sweeper (F6).
 *
 * Secure via CRON_SECRET header. Scheduled by .github/workflows/cron.yml.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'

export const dynamic = 'force-dynamic'

const MAX_ATTEMPTS = 5
const BATCH_LIMIT = 50

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: pending, error } = await supabase
    .from('notification_email_outbox')
    .select('id, to_email, subject, html_body, attempts')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT)

  if (error) {
    console.error('[notification-outbox-retry] query failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  let stillFailing = 0
  let deadLettered = 0

  for (const row of pending ?? []) {
    const result = await sendBrevoEmail({ to: row.to_email, subject: row.subject, htmlBody: row.html_body })

    if (result.success) {
      await supabase
        .from('notification_email_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', row.id)
      sent++
      continue
    }

    const attempts = row.attempts + 1
    const isDead = attempts >= MAX_ATTEMPTS
    await supabase
      .from('notification_email_outbox')
      .update({
        attempts,
        last_error: result.error ?? 'unknown error',
        status: isDead ? 'failed' : 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (isDead) {
      deadLettered++
      console.error(`[notification-outbox-retry] DEAD-LETTERED email to ${row.to_email} ("${row.subject}") after ${attempts} attempts — needs manual investigation.`)
    } else {
      stillFailing++
    }
  }

  const summary = { candidates: pending?.length ?? 0, sent, still_failing: stillFailing, dead_lettered: deadLettered }
  console.log('[notification-outbox-retry]', JSON.stringify(summary))
  return NextResponse.json(summary)
}
