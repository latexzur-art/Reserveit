/**
 * Booking Pipeline Orchestrator
 * Runs all 4 pipeline steps for a pending booking.
 * Call this immediately after inserting a new booking record.
 * @module backend/booking/bookingPipeline
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookingContext, PipelineResult } from './booking.types'
import { checkUserRestriction } from './restrictionChecker'
import { sendNotification as sendNotif } from './autoDecisionRouter'
import { checkHardConstraints } from './hardConstraintChecker'
import { calculateScore } from './softScoringEngine'
import { makeDecision } from './autoDecisionRouter'
import { sendNotification, sendNotificationToRoles } from './autoDecisionRouter'
import { checkFacilityPurposeMismatch } from './facilityMismatchChecker'
import { getSuggestions } from './suggestionEngine'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { mismatchedReservationEmail, facultyMismatchNotificationEmail } from '@/backend/notifications/emailTemplates'
import { getAcademicHeadEmail } from '@/backend/notifications/recipientResolver'

export async function processBooking(
  supabase: SupabaseClient,
  bookingId: string
): Promise<PipelineResult> {
  // Load the booking record (without the fragile users inner join)
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      id,
      user_id,
      booking_reference,
      created_at,
      booking_date,
      start_time,
      end_time,
      booking_purpose,
      purpose,
      event_name,
      expected_attendees,
      special_requests,
      self_facilitation_confirmed,
      facilitator_name,
      time_slot_id,
      facility_purpose_category,
      mismatch_justification,
      booking_course_code,
      booking_department_code,
      session_type,
      booking_facilities(facility_id),
      booking_equipment(equipment_id)
    `)
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    console.error('[Pipeline] Booking query failed for bookingId:', bookingId, bookingError?.message ?? 'no data')
    // Mark as declined so it doesn't block future bookings as a ghost 'pending' record
    await supabase.from('bookings').update({ current_status: 'auto_declined' }).eq('id', bookingId)
    return {
      status: 'auto_declined',
      message: `Booking ${bookingId} not found`,
      reason: 'Booking record missing',
    }
  }

  // ---- IDEMPOTENCY GUARD ----
  // Atomically claim this booking. Only the first caller to flip pipeline_processed_at
  // from NULL wins; any concurrent/duplicate invocation (server after() + client retry +
  // cron sweeper) reads back no row and no-ops. This is what makes the pipeline safe to
  // trigger from multiple places without double-scoring or double-notifying.
  const { data: claim } = await supabase
    .from('bookings')
    .update({ pipeline_processed_at: new Date().toISOString() })
    .eq('id', bookingId)
    .is('pipeline_processed_at', null)
    .select('id')
    .maybeSingle()

  if (!claim) {
    const { data: current } = await supabase
      .from('bookings')
      .select('current_status')
      .eq('id', bookingId)
      .single()
    console.log(`[Pipeline] Booking ${bookingId} already processed (status=${current?.current_status}) — skipping duplicate run`)
    return {
      status: (current?.current_status ?? 'pending') as PipelineResult['status'],
      booking_id: bookingId,
      reason: 'Pipeline already processed for this booking',
    }
  }

  // ---- F1/F11: provisional claim guard ----
  // Everything from here on runs under the claim we just took. If ANY of it throws
  // (a rules-load error in checkHardConstraints/calculateScore, a missing-user throw
  // in checkUserRestriction, a transient network blip, etc.) the claim above would
  // otherwise be left permanently set with current_status still 'pending' — invisible
  // to the sweeper, which only picks up pipeline_processed_at IS NULL. Reset the claim
  // on any throw so the booking becomes eligible for a retry (by the sweeper or a
  // manual /process call) instead of being silently stranded forever.
  try {
    return await runPipelineSteps(supabase, bookingId, booking)
  } catch (err) {
    console.error(`[Pipeline] Unhandled error processing booking ${bookingId} — resetting claim for retry:`, err)
    // Only reset if still 'pending' — if a throw happened after a terminal status was
    // already committed (e.g. in the post-decision race-guard fetch), leave the claim
    // alone so a decided booking is never re-run.
    // F6: bump the attempt counter alongside the reset so the sweeper can dead-letter
    // a row that throws deterministically instead of retrying it forever.
    const { data: attemptRow } = await supabase
      .from('bookings')
      .select('pipeline_attempts')
      .eq('id', bookingId)
      .single()
    await supabase
      .from('bookings')
      .update({
        pipeline_processed_at: null,
        pipeline_attempts: ((attemptRow?.pipeline_attempts as number | null) ?? 0) + 1,
      })
      .eq('id', bookingId)
      .eq('current_status', 'pending')
    throw err
  }
}

async function runPipelineSteps(
  supabase: SupabaseClient,
  bookingId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: Record<string, any>
): Promise<PipelineResult> {
  // Fetch user data separately to avoid inner join failures
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select(`
      full_name,
      user_type,
      account_status,
      department_id,
      departments!department_id(id, code, name),
      user_roles!user_id(roles(name))
    `)
    .eq('id', booking.user_id)
    .single()

  if (userError || !userData) {
    console.error('[Pipeline] User query failed for bookingId:', bookingId, userError?.message ?? 'no data')
    await supabase.from('bookings').update({ current_status: 'auto_declined' }).eq('id', bookingId)
    return {
      status: 'auto_declined',
      message: `User data for booking ${bookingId} not found`,
      reason: 'User record missing',
    }
  }

  const facilityId = (booking.booking_facilities as Array<{ facility_id: string }>)?.[0]?.facility_id
  if (!facilityId) {
    return {
      status: 'auto_declined',
      message: 'No facility linked to this booking',
      reason: 'Missing facility association',
    }
  }

  const equipmentIds = (booking.booking_equipment as Array<{ equipment_id: string }>)?.map(
    (e) => e.equipment_id
  ) ?? []

  // Fetch facility name for rich notifications
  const { data: facilityInfo } = await supabase
    .from('facilities')
    .select('name')
    .eq('id', facilityId)
    .single()

  const fmt12h = (t: string) => {
    const [hStr, mStr] = t.split(':')
    const h = parseInt(hStr, 10)
    return `${h % 12 || 12}:${mStr.padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }
  const bookingDateLabel = new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const userRoles: string[] = (
    (userData.user_roles as Array<{ roles: { name: string } | Array<{ name: string }> }> | null) ?? []
  ).map((ur) => {
    const r = ur.roles
    return Array.isArray(r) ? (r[0]?.name ?? '') : (r?.name ?? '')
  }).filter(Boolean)

  const requesterRoleLabel = (() => {
    const roleMap: Record<string, string> = {
      faculty: 'Faculty', program_head: 'Program Head', academic_head: 'Academic Head',
      building_admin: 'Building Admin', external_client: 'External Client', it_admin: 'IT Admin',
    }
    return roleMap[userRoles[0] ?? ''] ?? 'Faculty'
  })()

  const durationMins = (() => {
    const [sh, sm] = booking.start_time.split(':').map(Number)
    const [eh, em] = booking.end_time.split(':').map(Number)
    return (eh * 60 + em) - (sh * 60 + sm)
  })()
  const durationLabel = durationMins >= 60
    ? `${Math.floor(durationMins / 60)}h${durationMins % 60 ? ` ${durationMins % 60}m` : ''}`
    : `${durationMins}m`

  const bookingMeta: Record<string, unknown> = {
    booking_reference: (booking as Record<string, unknown>).booking_reference ?? null,
    requester_name: (userData as Record<string, unknown>).full_name ?? 'Unknown',
    requester_role: requesterRoleLabel,
    facility_name: facilityInfo?.name ?? 'Unknown Facility',
    booking_date: bookingDateLabel,
    start_time: fmt12h(booking.start_time),
    end_time: fmt12h(booking.end_time),
    duration: durationLabel,
    purpose: booking.purpose ?? booking.booking_purpose ?? 'Not specified',
    event_name: booking.event_name ?? null,
    expected_attendees: booking.expected_attendees ?? null,
  }

  // Extract department info
  const departments = (userData as Record<string, unknown>).departments
  const departmentData = Array.isArray(departments) ? departments[0] : departments as Record<string, string> | null

  const bookingContext: BookingContext = {
    booking_id: bookingId,
    user_id: booking.user_id,
    created_at: booking.created_at,
    user_type: (userData.user_type as 'internal' | 'external') ?? 'internal',
    user_roles: userRoles,
    account_status: userData.account_status ?? 'active',
    user_department_id: userData.department_id ?? null,
    user_department_code: (departmentData as Record<string, string> | null)?.code ?? null,
    facility_id: facilityId,
    booking_date: booking.booking_date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    booking_purpose: booking.booking_purpose,
    purpose: booking.purpose,
    event_name: booking.event_name,
    expected_attendees: booking.expected_attendees,
    special_requests: booking.special_requests,
    equipment_ids: equipmentIds,
    self_facilitation_confirmed: booking.self_facilitation_confirmed,
    facilitator_name: booking.facilitator_name,
    time_slot_id: booking.time_slot_id,
    facility_purpose_category: (booking as Record<string, unknown>).facility_purpose_category as string | null ?? null,
    mismatch_justification: (booking as Record<string, unknown>).mismatch_justification as string | null ?? null,
    booking_course_code: (booking as Record<string, unknown>).booking_course_code as string | null ?? null,
    booking_department_code: (booking as Record<string, unknown>).booking_department_code as string | null ?? null,
    session_type: (booking as Record<string, unknown>).session_type as 'lecture' | 'lab' | null ?? null,
  }

  console.log(`[Pipeline] Context built: user_roles=[${userRoles}], dept=${bookingContext.user_department_code}, purpose=${bookingContext.booking_purpose}`)

  // ---- Booking received confirmation ----
  // O3: fire-and-forget — this is a courtesy receipt, not a decision. Blocking STEP 0
  // on it serialises the whole decision behind a notification insert for no reason.
  const bookingRefLabel = (booking as Record<string, unknown>).booking_reference as string | undefined
  sendNotification(supabase, {
    user_id: booking.user_id,
    title: 'Booking Received',
    message: `Your booking ${bookingRefLabel ? `${bookingRefLabel} ` : ''}for ${facilityInfo?.name ?? 'the facility'} on ${bookingDateLabel} (${fmt12h(booking.start_time)}–${fmt12h(booking.end_time)}, ${durationLabel}) has been received. You will be notified once a decision is made.`,
    type: 'info',
    source_type: 'booking',
    source_id: bookingId,
    priority: 'normal',
    metadata: { ...bookingMeta, status_to: 'pending' },
  }).catch(err => console.error('[Pipeline] "Booking Received" notification failed:', err))

  // ---- STEP 0: Restriction check ----
  const restrictionResult = await checkUserRestriction(supabase, booking.user_id)
  console.log(`[Pipeline] STEP 0 — Restriction check: restricted=${restrictionResult.restricted}, probation=${restrictionResult.probation}`)

  if (restrictionResult.restricted) {
    // Route to manual queue — do NOT auto-approve
    await supabase
      .from('bookings')
      .update({
        current_status: 'pending',
        internal_notes: `Routed to manual review: ${restrictionResult.reason}`,
        assigned_reviewer_role: 'building_admin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Booking Pending Manual Review',
      message: `Your booking is pending administrator review due to account status. ${restrictionResult.reason}`,
      type: 'warning',
      source_type: 'booking',
      source_id: bookingId,
      priority: 'high',
      metadata: { ...bookingMeta, restriction_reason: restrictionResult.reason, status_to: 'pending' },
    })

    await sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'Restricted User Booking Requires Review',
      message: `A booking from a restricted user requires manual approval. User has ${restrictionResult.consecutive_cancellations} consecutive cancellations.`,
      type: 'warning',
      source_type: 'booking',
      source_id: bookingId,
      priority: 'high',
      metadata: { ...bookingMeta, consecutive_cancellations: restrictionResult.consecutive_cancellations, restriction_reason: restrictionResult.reason },
    })

    return {
      status: 'routed_to_manual',
      booking_id: bookingId,
      message: restrictionResult.reason,
      reason: 'Account restricted',
    }
  }

  // ---- STEP 1 & STEP 2 (O2): kick off soft scoring alongside hard constraints ----
  // calculateScore doesn't depend on the hard-constraint result, so there's no reason
  // to pay for it sequentially only on the (common) approval path. If hard constraints
  // fail, the score is simply never awaited/used below — discarded, no behavior change.
  // The upfront .catch(() => {}) only prevents a Node "unhandled rejection" warning
  // when the promise is discarded on that path; it does NOT suppress the rejection for
  // the real `await scoringPromise` below, which still throws normally (and is caught
  // by the F1/F11 claim-reset guard in processBooking) if calculateScore actually fails.
  const scoringPromise = calculateScore(supabase, bookingContext)
  scoringPromise.catch(() => {})

  // ---- STEP 1: Hard constraint check ----
  const hardResult = await checkHardConstraints(supabase, bookingContext)
  console.log(`[Pipeline] STEP 1 — Hard constraints: passed=${hardResult.passed}${hardResult.failed_code ? `, failed_code=${hardResult.failed_code}` : ''}`)

  if (!hardResult.passed) {
    if (!hardResult.is_reroutable) {
      // Auto-decline: not reroutable
      await supabase
        .from('bookings')
        .update({
          current_status: 'auto_declined',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)

      // Insert decision record
      await supabase.from('booking_decisions').insert({
        booking_id: bookingId,
        hard_constraints_passed: false,
        hard_constraint_failed_code: hardResult.failed_code,
        hard_constraint_details: hardResult.details ?? {},
        base_score: 100,
        score_adjustments: [],
        final_score: 0,
        decision: 'auto_declined',
        decision_reason: hardResult.message ?? `Hard constraint failed: ${hardResult.failed_code}`,
        pipeline_version: '1.0',
      })

      await sendNotification(supabase, {
        user_id: booking.user_id,
        title: 'Booking Declined',
        message: hardResult.message ?? 'Your booking was declined due to a policy constraint.',
        type: 'error',
        source_type: 'booking',
        source_id: bookingId,
        priority: 'high',
        metadata: { ...bookingMeta, rejection_reason: hardResult.message ?? `Hard constraint: ${hardResult.failed_code}`, status_to: 'auto_declined' },
      })

      return {
        status: 'hard_constraint_failed',
        booking_id: bookingId,
        failed_code: hardResult.failed_code,
        is_reroutable: false,
        message: hardResult.message,
        reason: `Hard constraint failed: ${hardResult.failed_code}`,
      }
    }

    // F2: reroutable failure in the async path — the client already received
    // {status:"processing"} and has moved on, so there is no synchronous caller left
    // to show suggestions to. Route to the manual admin queue instead of returning
    // without a status write (which used to strand the booking in 'pending' with the
    // idempotency claim set — the same invisible orphan as F1). Suggestions are
    // still computed and attached so the reviewing admin can act on them directly.
    const suggestions = await getSuggestions(supabase, hardResult.failed_code ?? '', bookingContext).catch((err) => {
      console.error('[Pipeline] getSuggestions failed for reroutable constraint:', err)
      return []
    })

    await supabase
      .from('bookings')
      .update({
        current_status: 'pending',
        assigned_reviewer_role: 'building_admin',
        internal_notes: `Routed to manual review — reroutable constraint failed: ${hardResult.failed_code}. ${hardResult.message ?? ''}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    await supabase.from('booking_decisions').insert({
      booking_id: bookingId,
      hard_constraints_passed: false,
      hard_constraint_failed_code: hardResult.failed_code,
      hard_constraint_details: hardResult.details ?? {},
      base_score: 100,
      score_adjustments: [],
      final_score: 0,
      decision: 'pending',
      decision_reason: `Reroutable constraint failed, routed to manual review: ${hardResult.failed_code}`,
      pipeline_version: '1.0',
    })

    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Booking Pending Manual Review',
      message: hardResult.message ?? 'Your requested slot is unavailable. An administrator will review your booking and may suggest an alternative.',
      type: 'warning',
      source_type: 'booking',
      source_id: bookingId,
      priority: 'high',
      metadata: { ...bookingMeta, failed_code: hardResult.failed_code, status_to: 'pending' },
    })

    await sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'Booking Requires Manual Review (Slot Conflict)',
      message: `A booking could not be auto-processed due to a reroutable constraint (${hardResult.failed_code}). ${suggestions.length} alternative(s) available.`,
      type: 'warning',
      source_type: 'booking',
      source_id: bookingId,
      priority: 'high',
      metadata: { ...bookingMeta, failed_code: hardResult.failed_code, suggestions },
    })

    return {
      status: 'routed_to_manual',
      booking_id: bookingId,
      failed_code: hardResult.failed_code,
      is_reroutable: true,
      message: hardResult.message,
      reason: `Reroutable constraint routed to manual review: ${hardResult.failed_code}`,
    }
  }

  // ---- STEP 2: Soft scoring (already running in parallel with STEP 1 — see above) ----
  const scoringResult = await scoringPromise
  console.log(`[Pipeline] STEP 2 — Soft scoring: base=${scoringResult.base_score}, final=${scoringResult.final_score}`)
  scoringResult.adjustments.forEach((a) => console.log(`  [Scoring]  ${a.code}: ${a.points > 0 ? '+' : ''}${a.points} (${a.reason})`))

  // ---- STEP 2.5: Facility-purpose mismatch check ----
  // Academic Head and Building Admin bookings skip mismatch logic because they are privileged users
  const isAcademicHead = bookingContext.user_roles.includes('academic_head')
  const isBuildingAdmin = bookingContext.user_roles.includes('building_admin')
  const mismatchResult = (isAcademicHead || isBuildingAdmin)
    ? { forceManualReview: false, scorePenalty: 0, adminMessage: 'Privileged user booking — mismatch check bypassed' }
    : await checkFacilityPurposeMismatch(supabase, {
      facilityId,
      departmentId: bookingContext.user_department_id,
      facilityPurposeCategory: bookingContext.facility_purpose_category ?? null,
      justificationText: bookingContext.mismatch_justification ?? null,
      bookingCourseCode: bookingContext.booking_course_code,
      sessionType: bookingContext.session_type,
    })

  if (mismatchResult.forceManualReview) {
    // Apply mismatch score penalty
    const penalizedScore = Math.max(0, scoringResult.final_score - mismatchResult.scorePenalty)

    // O3: booking_reference was already fetched with the initial booking record —
    // no need to re-query it here.
    const bookingRef = { booking_reference: bookingRefLabel }

    // Update booking: flag it for academic_head review
    await supabase
      .from('bookings')
      .update({
        current_status: 'flagged',
        mismatch_flag: (mismatchResult as any).flag ?? 'UNRECOGNIZED_CROSS_DEPT_USE',
        assigned_reviewer_role: 'academic_head',
        internal_notes: mismatchResult.adminMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    // Insert decision record
    await supabase.from('booking_decisions').insert({
      booking_id: bookingId,
      hard_constraints_passed: true,
      base_score: scoringResult.base_score,
      score_adjustments: scoringResult.adjustments,
      final_score: penalizedScore,
      decision: 'flagged',
      decision_reason: 'FACILITY_PURPOSE_MISMATCH',
      pipeline_version: '1.0',
    })

    // Notify faculty member
    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Booking Pending Academic Head Review',
      message: `Your booking (Ref: ${bookingRef?.booking_reference ?? bookingId}) is under review by the Academic Head due to a specialized facility booking. You will be notified once a decision is made.`,
      type: 'warning',
      source_type: 'booking',
      source_id: bookingId,
      priority: 'high',
      metadata: { ...bookingMeta, mismatch_flag: (mismatchResult as any).flag, status_to: 'flagged' },
    })

    // Notify Academic Head(s)
    await sendNotificationToRoles(supabase, ['academic_head'], {
      title: 'Mismatch Booking Requires Review',
      message: mismatchResult.adminMessage ?? `A booking requires review: specialized facility booking by a faculty member outside the primary department.`,
      type: 'warning',
      source_type: 'booking',
      source_id: bookingId,
      priority: 'high',
      metadata: { ...bookingMeta, mismatch_flag: (mismatchResult as any).flag, mismatch_reason: mismatchResult.adminMessage },
    })

    // Send email notifications (fire-and-forget)
    // O3: facility name was already fetched (facilityInfo) — only the requester
    // still needs a fresh query here.
    const { data: requesterData } = await supabase
      .from('users').select('full_name, email, notification_email').eq('id', booking.user_id).single()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const mismatchFlag = (mismatchResult as any).flag ?? ''
    const formattedDate = new Date(bookingContext.booking_date).toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    // Email to Academic Head
    const adminEmailPayload = mismatchedReservationEmail({
      bookingReference: bookingRef?.booking_reference ?? bookingId,
      requesterName: requesterData?.full_name ?? 'Unknown',
      facilityName: facilityInfo?.name ?? 'Unknown Facility',
      bookingDate: formattedDate,
      sessionType: bookingContext.session_type ?? 'Not specified',
      facilityCategory: bookingContext.facility_purpose_category ?? 'Not specified',
      mismatchFlag,
      purpose: bookingContext.purpose,
      score: penalizedScore,
      reviewUrl: `${appUrl}/academic/dashboard`,
    })

    const academicHeadEmail = await getAcademicHeadEmail()
    if (academicHeadEmail) {
      sendBrevoEmail({ to: academicHeadEmail, subject: adminEmailPayload.subject, htmlBody: adminEmailPayload.htmlBody })
        .catch(err => console.error('[bookingPipeline] Mismatch email (admin) failed:', err))
    } else {
      console.warn('[bookingPipeline] Mismatch admin email skipped — no active Academic Head found')
    }

    // Email to faculty member — notification_email only, never the Entra/Azure sign-in email
    const facultyEmail = requesterData?.notification_email ?? null
    if (!facultyEmail) {
      console.warn(`[bookingPipeline] User ${booking.user_id} has no notification_email set — mismatch email skipped`)
    } else {
      const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
      const facultyEmailPayload = facultyMismatchNotificationEmail({
        bookingReference: bookingRef?.booking_reference ?? bookingId,
        facultyName: requesterData?.full_name ?? 'Faculty',
        facilityName: facilityInfo?.name ?? 'Unknown Facility',
        bookingDate: formattedDate,
        startTime: fmt(bookingContext.start_time),
        endTime: fmt(bookingContext.end_time),
        mismatchFlag,
        statusUrl: `${appUrl}/faculty/reservations`,
      })
      sendBrevoEmail({ to: facultyEmail, subject: facultyEmailPayload.subject, htmlBody: facultyEmailPayload.htmlBody })
        .catch(err => console.error('[bookingPipeline] Mismatch email (faculty) failed:', err))
    }

    return {
      status: 'flagged',
      booking_id: bookingId,
      booking_reference: bookingRef?.booking_reference,
      score: penalizedScore,
      reason: 'FACILITY_PURPOSE_MISMATCH',
    }
  }

  // ---- STEP 3: Auto decision routing ----
  const isProbation = restrictionResult.probation
  const bookingDurationMinutes = (() => {
    const [sh, sm] = bookingContext.start_time.split(':').map(Number)
    const [eh, em] = bookingContext.end_time.split(':').map(Number)
    return (eh * 60 + em) - (sh * 60 + sm)
  })()
  console.log(`[Pipeline] STEP 3 — Routing: isProbation=${isProbation}, score=${scoringResult.final_score}, durationMinutes=${bookingDurationMinutes}`)
  const decisionResult = await makeDecision(
    supabase,
    bookingId,
    booking.user_id,
    scoringResult,
    isProbation,
    { all_results: hardResult.all_results },
    bookingContext.user_roles,
    bookingDurationMinutes,
    (mismatchResult as any).flag ?? null,
    bookingMeta
  )

  console.log(`[Pipeline] DECISION: status=${decisionResult.status}, reason="${decisionResult.reason}"`)

  // ---- POST-DECISION: Race condition guard (F4) ----
  // Re-check for booking conflicts AFTER the decision was committed, via the
  // finalize_booking_approval RPC (supabase/migrations/20260731140000_atomic_approval_race_guard.sql).
  // That function serializes concurrent callers with a transaction-scoped advisory
  // lock on (facility_id, booking_date) and breaks ties by created_at (earlier
  // booking wins) — a plain SELECT-then-maybe-UPDATE here (the old approach) is not
  // atomic relative to another booking's own race-guard check running at the same
  // moment for the same slot, which is exactly the race this guard exists to close.
  if (decisionResult.status === 'auto_approved' || decisionResult.status === 'approved') {
    const { data: survives, error: raceGuardError } = await supabase.rpc('finalize_booking_approval', {
      p_booking_id: bookingId,
      p_facility_id: facilityId,
      p_booking_date: bookingContext.booking_date,
      p_start_time: bookingContext.start_time,
      p_end_time: bookingContext.end_time,
    })

    if (raceGuardError) {
      // Fail closed: if we can't verify the booking is conflict-free, don't leave it
      // silently approved — flag it for a human rather than fail-open.
      console.error('[Pipeline] finalize_booking_approval RPC failed, flagging for manual review:', raceGuardError.message)
      await supabase
        .from('bookings')
        .update({ current_status: 'flagged', assigned_reviewer_role: 'building_admin', internal_notes: 'Race-guard verification failed after auto-approval — flagged for manual confirmation.', updated_at: new Date().toISOString() })
        .eq('id', bookingId)
    } else if (survives === false) {
      console.warn(`[Pipeline] RACE CONDITION DETECTED: booking ${bookingId} lost the slot to an earlier-created conflicting booking. Rolling back.`)
      await supabase
        .from('bookings')
        .update({ current_status: 'auto_declined', updated_at: new Date().toISOString() })
        .eq('id', bookingId)

      await sendNotif(supabase, {
        user_id: booking.user_id,
        title: 'Booking Conflict Detected',
        message: 'Your booking was declined because another booking for the same time slot was confirmed moments before yours. Please try a different time.',
        type: 'error',
        source_type: 'booking',
        source_id: bookingId,
        priority: 'high',
        metadata: { ...bookingMeta, status_to: 'auto_declined', rejection_reason: 'Concurrent booking conflict' },
      })

      return {
        status: 'auto_declined',
        booking_id: bookingId,
        score: scoringResult.final_score,
        reason: 'Concurrent booking conflict detected — another booking was approved for this slot.',
      }
    }
  }

  return {
    status: decisionResult.status,
    booking_id: bookingId,
    score: scoringResult.final_score,
    oversight_expires_at: decisionResult.oversight_expires_at,
    reason: decisionResult.reason,
    decision_id: decisionResult.decision_id,
  }
}
