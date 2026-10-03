/**
 * GET /api/cron/booking-pipeline-sweep
 *
 * Safety net for the async decision pipeline. New bookings run the pipeline
 * server-side via after() in POST /api/bookings, so orphans are now rare — but if a
 * serverless invocation dies before after() completes, a booking can be left
 * 'pending' with pipeline_processed_at IS NULL. This sweep reprocesses those.
 *
 * Two orphan shapes, both auto-decision path only (requires_payment = false):
 *   (a) never claimed:  current_status='pending' AND pipeline_processed_at IS NULL
 *       — the pipeline demonstrably never ran (after() died before the claim UPDATE).
 *   (b) claimed but stranded: current_status='pending' AND pipeline_processed_at IS
 *       NOT NULL AND older than the grace window — the claim was taken but the process
 *       was killed hard enough that not even the F1/F11 catch-block claim-reset ran
 *       (e.g. serverless function frozen/killed mid-request, not a JS throw). (F1)
 *
 * F6: rows that have failed pipeline_attempts >= MAX_ATTEMPTS times are dead-lettered
 * (skipped, logged) instead of retried forever every 5 minutes.
 *
 * processBooking is idempotent (atomic pipeline_processed_at claim), so even if a run
 * overlaps an after() invocation, only one wins.
 *
 * Secure via CRON_SECRET header. Scheduled by .github/workflows/cron.yml.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { processBooking } from '@/backend/booking'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// Grace window: don't sweep bookings younger than this, to avoid racing a still-running after().
const GRACE_MINUTES = 2
// Cap per run so a backlog can't blow the function timeout.
const BATCH_LIMIT = 25
// F6: stop retrying a row after this many failed attempts — dead-letter it instead.
const MAX_ATTEMPTS = 5

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - GRACE_MINUTES * 60_000).toISOString()

  const [{ data: neverClaimed, error: neverClaimedError }, { data: stranded, error: strandedError }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, booking_reference, pipeline_attempts')
      .eq('current_status', 'pending')
      .is('pipeline_processed_at', null)
      .eq('requires_payment', false)
      .lt('created_at', cutoff)
      .lt('pipeline_attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT),
    supabase
      .from('bookings')
      .select('id, booking_reference, pipeline_attempts')
      .eq('current_status', 'pending')
      .not('pipeline_processed_at', 'is', null)
      .eq('requires_payment', false)
      .lt('pipeline_processed_at', cutoff)
      .lt('pipeline_attempts', MAX_ATTEMPTS)
      .order('pipeline_processed_at', { ascending: true })
      .limit(BATCH_LIMIT),
  ])

  if (neverClaimedError || strandedError) {
    const msg = neverClaimedError?.message ?? strandedError?.message ?? 'unknown error'
    console.error('[booking-pipeline-sweep] query failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // A stranded claimed row needs its claim reset before processBooking will touch it
  // again (the idempotency guard only proceeds when pipeline_processed_at IS NULL).
  for (const b of stranded ?? []) {
    await supabase.from('bookings').update({ pipeline_processed_at: null }).eq('id', b.id)
  }

  const orphans = [...(neverClaimed ?? []), ...(stranded ?? [])]

  const results: Array<{ booking_id: string; status?: string; error?: string }> = []
  for (const b of orphans) {
    try {
      const r = await processBooking(supabase, b.id)
      console.log(`[booking-pipeline-sweep] reprocessed ${b.booking_reference ?? b.id} → ${r.status}`)
      results.push({ booking_id: b.id, status: r.status })
    } catch (err) {
      const msg = getErrorMessage(err)
      console.error(`[booking-pipeline-sweep] failed to reprocess ${b.id}:`, msg)
      results.push({ booking_id: b.id, error: msg })
    }
  }

  // F6: log (dead-letter visibility) any rows sitting at/above the attempt cap so a
  // human can inspect them — they're intentionally excluded from the queries above.
  const { data: deadLettered } = await supabase
    .from('bookings')
    .select('id, booking_reference, pipeline_attempts')
    .eq('current_status', 'pending')
    .eq('requires_payment', false)
    .gte('pipeline_attempts', MAX_ATTEMPTS)
    .limit(BATCH_LIMIT)

  if (deadLettered && deadLettered.length > 0) {
    console.error(
      '[booking-pipeline-sweep] DEAD-LETTERED rows (pipeline_attempts >= MAX_ATTEMPTS, needs manual investigation):',
      deadLettered.map(d => d.booking_reference ?? d.id).join(', ')
    )
  }

  const summary = {
    candidates: orphans.length,
    never_claimed: neverClaimed?.length ?? 0,
    stranded_claimed: stranded?.length ?? 0,
    reprocessed: results.length,
    dead_lettered: deadLettered?.length ?? 0,
    results,
  }
  console.log('[booking-pipeline-sweep]', JSON.stringify({
    candidates: summary.candidates,
    never_claimed: summary.never_claimed,
    stranded_claimed: summary.stranded_claimed,
    reprocessed: summary.reprocessed,
    dead_lettered: summary.dead_lettered,
  }))
  return NextResponse.json(summary)
}
