/**
 * GET /api/cron/pending-approval-sla
 *
 * F3/L1 — SLA reminder + escalation for the internal (non-paid) "awaiting a human"
 * decision path. Nothing else nudges these queues:
 *   - academic-head-reminders only covers maintenance/facility blocks.
 *   - booking-reminders only pings requesters about upcoming approved bookings.
 *   - oversight-expiry only touches auto_approved.
 *
 * Covers three "awaiting a human" shapes on the internal path (paid/gym bookings are
 * explicitly out of scope — plans/booking-pipeline-decision-time-audit.md Appendix A):
 *   1. flagged (Academic Head review)          — remind at T1, escalate to
 *      building_admin at T2.
 *   2. restriction-routed pending               — remind building_admin at T1
 *      (assigned_reviewer_role set by F9; already the terminal reviewer, no further
 *      escalation target).
 *   3. pending_faculty_response (mismatch alt.) — remind the faculty member at T1;
 *      past mismatch_alternative_deadline (F7), auto-decline (owner decision
 *      2026-07-31) instead of waiting forever with no clock.
 *
 * All age comparisons use true UTC (`Date.now()` / DB `created_at` / `mismatch_alternative_deadline`),
 * never getManilaNow() — see the timezone caveat in the audit plan (getManilaNow()'s
 * instant is shifted +8h and will silently skew any comparison against true UTC).
 *
 * Dedup: checks `notifications` for an existing 'pending_approval_sla' nudge with the
 * same booking_id + tier before sending again (same pattern as booking-reminders).
 *
 * L2 (piggybacked here rather than a separate cron): also emails admins an hourly
 * digest of auto_approved/auto_declined counts in the last hour. autoDecisionRouter.ts
 * stopped emailing admins immediately for those two decisions (still fanned out
 * in-app on every decision, unchanged) — flagged bookings need action now and still
 * get an immediate email, but auto-approved/auto-declined were inbox noise with
 * nothing to act on. This rolls them into one email per hour instead.
 *
 * Secure via CRON_SECRET header. Scheduled by .github/workflows/cron.yml.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { getBuildingAdminEmails, getAcademicHeadEmail } from '@/backend/notifications/recipientResolver'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// Owner-confirmed defaults (plan decision #3, 2026-07-31).
const T1_REMIND_HOURS = 24
const T2_ESCALATE_HOURS = 48

const BATCH_LIMIT = 50

async function alreadyNudged(supabase: ReturnType<typeof createAdminClient>, bookingId: string, tier: string) {
  const { data } = await supabase
    .from('notifications')
    .select('id')
    .eq('source_type', 'pending_approval_sla')
    .eq('source_id', bookingId)
    .filter('metadata->>tier', 'eq', tier)
    .limit(1)
    .maybeSingle()
  return !!data
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const nowMs = Date.now()
  const t1Cutoff = new Date(nowMs - T1_REMIND_HOURS * 3_600_000).toISOString()

  const counts = { flagged_reminded: 0, flagged_escalated: 0, restriction_reminded: 0, faculty_reminded: 0, faculty_auto_declined: 0 }
  const errors: Array<{ booking_id: string; stage: string; error: string }> = []

  try {
    // ---- 1. flagged: remind at T1, escalate at T2 ----
    const { data: flaggedOld } = await supabase
      .from('bookings')
      .select('id, booking_reference, created_at')
      .eq('current_status', 'flagged')
      .lt('created_at', t1Cutoff)
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT)

    for (const b of flaggedOld ?? []) {
      try {
        const ageHours = (nowMs - new Date(b.created_at).getTime()) / 3_600_000
        const tier = ageHours >= T2_ESCALATE_HOURS ? 'flagged_t2' : 'flagged_t1'
        if (await alreadyNudged(supabase, b.id, tier)) continue

        if (tier === 'flagged_t2') {
          await sendNotificationToRoles(supabase, ['building_admin'], {
            title: 'Escalated: Flagged Booking Needs Review',
            message: `Booking ${b.booking_reference ?? b.id} has been awaiting Academic Head review for over ${T2_ESCALATE_HOURS}h and is now escalated to Building Admin.`,
            type: 'warning',
            source_type: 'pending_approval_sla',
            source_id: b.id,
            priority: 'high',
            metadata: { tier, booking_reference: b.booking_reference, age_hours: Math.round(ageHours) },
          })
          counts.flagged_escalated++
        } else {
          await sendNotificationToRoles(supabase, ['academic_head'], {
            title: 'Reminder: Flagged Booking Awaiting Review',
            message: `Booking ${b.booking_reference ?? b.id} has been awaiting your review for over ${T1_REMIND_HOURS}h.`,
            type: 'warning',
            source_type: 'pending_approval_sla',
            source_id: b.id,
            priority: 'normal',
            metadata: { tier, booking_reference: b.booking_reference, age_hours: Math.round(ageHours) },
          })
          counts.flagged_reminded++
        }
      } catch (err) {
        errors.push({ booking_id: b.id, stage: 'flagged', error: getErrorMessage(err) })
      }
    }

    // ---- 2. restriction-routed pending: remind building_admin at T1 ----
    const { data: restrictionPending } = await supabase
      .from('bookings')
      .select('id, booking_reference, created_at')
      .eq('current_status', 'pending')
      .eq('assigned_reviewer_role', 'building_admin')
      .eq('requires_payment', false)
      .lt('created_at', t1Cutoff)
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT)

    for (const b of restrictionPending ?? []) {
      try {
        const tier = 'restriction_t1'
        if (await alreadyNudged(supabase, b.id, tier)) continue
        const ageHours = (nowMs - new Date(b.created_at).getTime()) / 3_600_000
        await sendNotificationToRoles(supabase, ['building_admin'], {
          title: 'Reminder: Booking Awaiting Manual Review',
          message: `Booking ${b.booking_reference ?? b.id} has been awaiting manual review for over ${T1_REMIND_HOURS}h.`,
          type: 'warning',
          source_type: 'pending_approval_sla',
          source_id: b.id,
          priority: 'normal',
          metadata: { tier, booking_reference: b.booking_reference, age_hours: Math.round(ageHours) },
        })
        counts.restriction_reminded++
      } catch (err) {
        errors.push({ booking_id: b.id, stage: 'restriction_pending', error: getErrorMessage(err) })
      }
    }

    // ---- 3. pending_faculty_response: remind at T1, auto-decline past deadline (F7) ----
    const { data: awaitingFaculty } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, created_at, mismatch_alternative_deadline, mismatch_reviewed_by')
      .eq('current_status', 'pending_faculty_response')
      .limit(BATCH_LIMIT)

    for (const b of awaitingFaculty ?? []) {
      try {
        const deadlinePassed = !!b.mismatch_alternative_deadline && new Date(b.mismatch_alternative_deadline).getTime() < nowMs

        if (deadlinePassed) {
          await supabase
            .from('bookings')
            .update({
              current_status: 'auto_declined',
              internal_notes: 'Auto-declined: faculty did not respond to the suggested alternative facility before the deadline.',
              updated_at: new Date().toISOString(),
            })
            .eq('id', b.id)
            .eq('current_status', 'pending_faculty_response') // guard against a race with accept-alternative

          await supabase.from('booking_decisions').insert({
            booking_id: b.id,
            hard_constraints_passed: true,
            base_score: null,
            score_adjustments: null,
            final_score: null,
            decision: 'auto_declined',
            decision_reason: 'MISMATCH_ALTERNATIVE_RESPONSE_TIMEOUT',
            pipeline_version: '1.0',
          })

          await sendNotification(supabase, {
            user_id: b.user_id,
            title: 'Booking Declined — No Response',
            message: `Your booking ${b.booking_reference ?? b.id} was declined because no response was received to the suggested alternative facility within the response window.`,
            type: 'error',
            source_type: 'booking',
            source_id: b.id,
            priority: 'high',
            metadata: { booking_reference: b.booking_reference, status_to: 'auto_declined', rejection_reason: 'No response to alternative facility suggestion' },
          })

          if (b.mismatch_reviewed_by) {
            await sendNotification(supabase, {
              user_id: b.mismatch_reviewed_by,
              title: 'Alternative Facility Offer Expired',
              message: `Booking ${b.booking_reference ?? b.id} was auto-declined — the faculty member never responded to your suggested alternative.`,
              type: 'info',
              source_type: 'booking',
              source_id: b.id,
              priority: 'normal',
              metadata: { booking_reference: b.booking_reference },
            })
          }

          counts.faculty_auto_declined++
          continue
        }

        // Not past deadline yet — remind once at T1 age.
        const ageHours = (nowMs - new Date(b.created_at).getTime()) / 3_600_000
        if (ageHours < T1_REMIND_HOURS) continue
        const tier = 'faculty_t1'
        if (await alreadyNudged(supabase, b.id, tier)) continue

        await sendNotification(supabase, {
          user_id: b.user_id,
          title: 'Reminder: Respond to Suggested Alternative Facility',
          message: `Booking ${b.booking_reference ?? b.id} has an alternative facility suggestion awaiting your response.`,
          type: 'warning',
          source_type: 'pending_approval_sla',
          source_id: b.id,
          priority: 'normal',
          metadata: { tier, booking_reference: b.booking_reference, age_hours: Math.round(ageHours) },
        })
        counts.faculty_reminded++
      } catch (err) {
        errors.push({ booking_id: b.id, stage: 'pending_faculty_response', error: getErrorMessage(err) })
      }
    }
  } catch (err) {
    console.error('[pending-approval-sla] fatal error:', getErrorMessage(err))
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }

  // ---- L2: hourly admin digest for non-urgent decisions ----
  let digestSent = false
  try {
    const digestWindowStart = new Date(nowMs - 3_600_000).toISOString()
    const { data: recentDecisions } = await supabase
      .from('bookings')
      .select('current_status')
      .in('current_status', ['auto_approved', 'auto_declined'])
      .gte('updated_at', digestWindowStart)
      .lt('updated_at', new Date(nowMs).toISOString())

    const approvedCount = (recentDecisions ?? []).filter(b => b.current_status === 'auto_approved').length
    const declinedCount = (recentDecisions ?? []).filter(b => b.current_status === 'auto_declined').length

    if (approvedCount + declinedCount > 0) {
      const [adminEmails, ahEmail] = await Promise.all([getBuildingAdminEmails(), getAcademicHeadEmail()])
      const recipients = [...new Set([...(adminEmails ?? []), ...(ahEmail ? [ahEmail] : [])])]
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const subject = `Booking activity digest — ${approvedCount} approved, ${declinedCount} declined (last hour)`
      const htmlBody = `
        <p>Automated decision summary for the last hour:</p>
        <ul>
          <li><strong>${approvedCount}</strong> booking(s) auto-approved</li>
          <li><strong>${declinedCount}</strong> booking(s) auto-declined</li>
        </ul>
        <p>No action needed — this is informational. Flagged bookings requiring review are still emailed immediately.</p>
        <p><a href="${appUrl}/admin/building/reservations">View reservations dashboard</a></p>
      `
      await Promise.all(recipients.map(to => sendBrevoEmail({ to, subject, htmlBody }).catch(err => console.error('[pending-approval-sla] digest email failed:', err))))
      digestSent = true
    }
  } catch (err) {
    console.error('[pending-approval-sla] digest error:', getErrorMessage(err))
  }

  console.log('[pending-approval-sla]', JSON.stringify({ counts, errorCount: errors.length, digestSent }))
  return NextResponse.json({ counts, errors, digestSent })
}
