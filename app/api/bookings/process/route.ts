import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { processBooking } from '@/backend/booking'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// Roles allowed to manually (re)trigger the decision pipeline for a booking.
const PRIVILEGED_ROLES = new Set(['building_admin', 'admin', 'it_administrator'])

/**
 * POST /api/bookings/process
 *
 * Manual pipeline (re)trigger. The normal path no longer uses this — new bookings
 * run the pipeline server-side via after() in POST /api/bookings. This endpoint is a
 * recovery tool for administrators (e.g. a booking that got stuck mid-run) and for
 * the cron sweeper (via CRON_SECRET).
 *
 * Auth: either a valid CRON_SECRET bearer token, or an authenticated privileged user.
 * Passing { force: true } clears a stale pipeline claim so a still-'pending' booking
 * can be reprocessed; the pipeline stays idempotent for everything else.
 */
export async function POST(request: NextRequest) {
  try {
    // Path 1: server-to-server via cron secret.
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`

    // Path 2: authenticated privileged human.
    if (!isCron) {
      const { error, user } = await requireAuthenticatedUser()
      if (error) return error
      const isPrivileged = (user.roles ?? []).some((r: { name: string }) => PRIVILEGED_ROLES.has(r.name))
      if (!isPrivileged) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { booking_id, force } = await request.json()
    if (!booking_id) return NextResponse.json({ error: 'Missing booking_id' }, { status: 400 })

    const supabase = createAdminClient()

    // Force-retry: only ever clears the claim on a booking that is STILL pending
    // (never a decided/terminal one), so a legit manual-routed or approved booking
    // can't be re-run and re-notified.
    if (force) {
      await supabase
        .from('bookings')
        .update({ pipeline_processed_at: null })
        .eq('id', booking_id)
        .eq('current_status', 'pending')
    }

    const pipelineResult = await processBooking(supabase, booking_id)
    return NextResponse.json(pipelineResult, { status: 200 })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
