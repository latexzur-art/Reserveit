/**
 * Auto Decision Router
 * Converts a soft score to a booking decision, updates the booking record,
 * inserts a booking_decisions row, and sends notifications.
 * @module backend/booking/autoDecisionRouter
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookingStatus, ScoringResult } from './booking.types'
import { SCORING_THRESHOLDS, OVERSIGHT_WINDOW_HOURS } from './booking.types'
import { getManilaNow } from '@/lib/timezone'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { sendCriticalEmail } from '@/backend/notifications/emailOutbox'
import {
  bookingConfirmationEmail,
  bookingRejectionEmail,
  adminPendingBookingEmail,
} from '@/backend/notifications/emailTemplates'

export interface DecisionResult {
  status: BookingStatus
  oversight_expires_at: string
  reason: string
  decision_id: string
}

export async function makeDecision(
  supabase: SupabaseClient,
  bookingId: string,
  userId: string,
  scoring: ScoringResult,
  isProbation: boolean,
  hardConstraintDetails: Record<string, unknown>,
  userRoles: string[] = [],
  durationMinutes: number = 0,
  mismatchFlag?: string | null,
  contextMetadata?: Record<string, unknown>
): Promise<DecisionResult> {
  const startTime = Date.now()

  // Determine decision
  let decision: BookingStatus
  let reason: string
  let isPolicyOverride = false

  const isAcademicHead = userRoles.includes('academic_head')
  const isBuildingAdmin = userRoles.includes('building_admin')

  if (isProbation) {
    decision = 'flagged'
    reason = 'Account is on probation — manual admin approval required regardless of score'
  } else if (isAcademicHead) {
    decision = 'auto_approved'
    reason = 'Academic Head privileged booking — auto-approved by policy'
    isPolicyOverride = true
  } else if (isBuildingAdmin) {
    decision = 'auto_approved'
    reason = 'Building Admin privileged booking — auto-approved by policy'
    isPolicyOverride = true
  } else if (mismatchFlag === 'SESSION_LECTURE_IN_LAB_MISMATCH') {
    decision = 'flagged'
    reason = 'Lecture session booked in a lab facility — forced Academic Head review'
  } else if (scoring.final_score >= SCORING_THRESHOLDS.AUTO_APPROVE) {
    decision = 'auto_approved'
    reason = `Score ${scoring.final_score}/100 meets auto-approval threshold (≥${SCORING_THRESHOLDS.AUTO_APPROVE})`
  } else if (scoring.final_score >= SCORING_THRESHOLDS.FLAG_MIN) {
    decision = 'flagged'
    reason = `Score ${scoring.final_score}/100 requires admin review (${SCORING_THRESHOLDS.FLAG_MIN}–${SCORING_THRESHOLDS.AUTO_APPROVE - 1})`
  } else {
    decision = 'auto_declined'
    reason = `Score ${scoring.final_score}/100 is below minimum threshold (<${SCORING_THRESHOLDS.AUTO_DECLINE_BELOW})`
  }

  const oversightExpiresAt = new Date(getManilaNow().getTime() + OVERSIGHT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const processingTimeMs = Date.now() - startTime

  // Update booking record
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      current_status: decision,
      decision_score: scoring.final_score,
      oversight_expires_at: oversightExpiresAt,
      policy_override: isPolicyOverride,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)

  if (updateError) {
    console.error('[makeDecision] Failed to update booking:', updateError)
    throw new Error(
      `Failed to update booking ${bookingId}: ${updateError.message} (code: ${updateError.code})`
    )
  }

  // Reset consecutive cancellation counter on approval so that
  // an approved booking "breaks the streak" (not just completed ones)
  if (decision === 'auto_approved') {
    await supabase
      .from('users')
      .update({ consecutive_cancellations: 0, updated_at: new Date().toISOString() })
      .eq('id', userId)
  }

  // Insert booking_decisions record
  const { data: decisionRow, error: decisionError } = await supabase
    .from('booking_decisions')
    .insert({
      booking_id: bookingId,
      hard_constraints_passed: true,
      hard_constraint_failed_code: null,
      hard_constraint_details: hardConstraintDetails,
      base_score: scoring.base_score,
      score_adjustments: scoring.adjustments,
      final_score: scoring.final_score,
      decision,
      decision_reason: reason,
      pipeline_version: '1.0',
      processing_time_ms: processingTimeMs,
    })
    .select('id')
    .single()

  if (decisionError) {
    console.error('[autoDecisionRouter] Failed to insert booking_decision:', decisionError.message)
  }

  // Get booking reference for notifications
  const { data: booking } = await supabase
    .from('bookings')
    .select('booking_reference, user_id')
    .eq('id', bookingId)
    .single()

  const bookingRef = booking?.booking_reference ?? bookingId

  // Notify the user
  const userNotifications: Record<BookingStatus, { title: string; message: string; type: string }> = {
    auto_approved: {
      title: 'Booking Auto-Approved',
      message: (isAcademicHead || isBuildingAdmin)
        ? `Your booking ${bookingRef} has been automatically approved.`
        : `Your booking ${bookingRef} has been automatically approved (score: ${scoring.final_score}/100). Subject to 48-hour admin oversight.`,
      type: 'success',
    },
    flagged: {
      title: 'Booking Under Review',
      message: `Your booking ${bookingRef} has been confirmed and is pending admin review (score: ${scoring.final_score}/100).`,
      type: 'info',
    },
    auto_declined: {
      title: 'Booking Auto-Declined',
      message: `Your booking ${bookingRef} was automatically declined (score: ${scoring.final_score}/100). Reason: ${reason}`,
      type: 'error',
    },
    // Fallback — other statuses shouldn't reach here
    pending: { title: '', message: '', type: 'info' },
    approved: { title: '', message: '', type: 'info' },
    rejected: { title: '', message: '', type: 'info' },
    cancelled: { title: '', message: '', type: 'info' },
    completed: { title: '', message: '', type: 'info' },
    overridden: { title: '', message: '', type: 'info' },
    pending_faculty_response: { title: '', message: '', type: 'info' },
    pending_user_response: { title: '', message: '', type: 'info' },
    on_hold: { title: '', message: '', type: 'info' },
    cancellation_requested: { title: '', message: '', type: 'info' },
    awaiting_reschedule: { title: '', message: '', type: 'info' },
  }

  const userNotif = userNotifications[decision]
  if (userNotif.title) {
    await sendNotification(supabase, {
      user_id: userId,
      title: userNotif.title,
      message: userNotif.message,
      type: userNotif.type as 'info' | 'warning' | 'success' | 'error',
      source_type: 'booking',
      source_id: bookingId,
      priority: decision === 'auto_declined' ? 'high' : 'normal',
      metadata: contextMetadata
        ? { ...contextMetadata, decision_score: scoring.final_score, status_to: decision }
        : { decision_score: scoring.final_score, status_to: decision, booking_reference: bookingRef },
    })
  }

  // Notify all building admins and academic heads of ALL decisions
  const isPolicyOverrideStr = isPolicyOverride
  const requesterName = (contextMetadata?.requester_name as string) ?? 'A user'
  const facilityNameMeta = (contextMetadata?.facility_name as string) ?? 'a facility'
  const bookingDateMeta = (contextMetadata?.booking_date as string) ?? ''

  const adminNotifTitle = isPolicyOverrideStr
    ? `Policy-Override Approval: ${bookingRef}`
    : decision === 'flagged'
      ? `Booking Needs Your Approval — ${bookingRef}`
      : `New Booking Decision: ${decision.replace('_', ' ').toUpperCase()}`

  const eventNameMeta = (contextMetadata?.event_name as string | null) ?? null

  const policyOverrideActor = isBuildingAdmin ? 'Building Admin' : 'Academic Head'
  const adminNotifMessage = isPolicyOverrideStr
    ? `Booking ${bookingRef} was auto-approved via ${policyOverrideActor} policy override (score bypassed). Review for compliance.`
    : decision === 'flagged'
      ? `${requesterName} has a new booking${eventNameMeta ? ` "${eventNameMeta}"` : ''} (${bookingRef}) for ${facilityNameMeta}${bookingDateMeta ? ` on ${bookingDateMeta}` : ''} that requires your approval. Score: ${scoring.final_score}/100.${isProbation ? ' User is on probation.' : ''}`
      : `Booking ${bookingRef}${eventNameMeta ? ` "${eventNameMeta}"` : ''} was ${decision.replace('_', ' ')} (score: ${scoring.final_score}/100). ${isProbation ? 'User is on probation.' : ''}`

  const adminPriority = isPolicyOverrideStr || decision === 'flagged' ? 'high' : 'normal'

  await sendNotificationToRoles(supabase, ['building_admin', 'academic_head'], {
    title: adminNotifTitle,
    message: adminNotifMessage,
    type: isPolicyOverrideStr ? 'warning' : decision === 'auto_declined' ? 'warning' : 'info',
    source_type: 'booking',
    source_id: bookingId,
    priority: adminPriority,
    metadata: contextMetadata
      ? { ...contextMetadata, decision_score: scoring.final_score, status_to: decision, policy_override: isPolicyOverrideStr }
      : { decision_score: scoring.final_score, status_to: decision, booking_reference: bookingRef, policy_override: isPolicyOverrideStr },
  })

  // ── Send booking lifecycle emails via Brevo (fire-and-forget) ──────────────
  void (async () => {
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('full_name, email, notification_email')
        .eq('id', userId)
        .single()

      if (!userRow) return

      const recipient = (userRow.notification_email ?? null) as string | null
      if (!recipient) {
        console.warn(`[autoDecisionRouter] User ${userId} has no notification_email set — booking email skipped`)
        return
      }

      const userName = (userRow.full_name as string) ?? 'User'
      const userRole = userRoles[0]
        ? userRoles[0].split('_').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')
        : ''

      const meta = contextMetadata ?? {}
      const facilityName = (meta.facility_name as string) ?? 'your facility'
      const bookingDate = (meta.booking_date as string) ?? ''
      const startTime = (meta.start_time as string) ?? ''
      const endTime = (meta.end_time as string) ?? ''
      const purpose = (meta.purpose as string) ?? ''
      const eventName = (meta.event_name as string | null) ?? undefined

      // Duration label from contextMetadata or fall back to empty
      const durationMinutesVal = durationMinutes
      const durationStr = durationMinutesVal >= 60
        ? `${Math.floor(durationMinutesVal / 60)}h${durationMinutesVal % 60 ? ` ${durationMinutesVal % 60}m` : ''}`
        : durationMinutesVal > 0 ? `${durationMinutesVal}m` : ''

      // F5: these two are the priority-tier decision emails (the actual outcome the
      // requester needs to see) — route through the outbox fallback so a Brevo
      // failure gets retried instead of silently vanishing. The admin FYI blast below
      // stays best-effort (informational copy, not the requester's only channel for
      // their own decision — in-app notifications already covered that).
      if (decision === 'auto_approved' || decision === 'flagged') {
        void sendCriticalEmail(
          supabase,
          {
            to: recipient,
            ...bookingConfirmationEmail({
              userName,
              bookingRef: bookingRef,
              facilityName,
              bookingDate,
              startTime,
              endTime,
              duration: durationStr,
              purpose,
              eventName,
              status: decision,
              userRole,
            }),
          },
          { sourceType: 'booking_decision', sourceId: bookingId }
        )
      } else if (decision === 'auto_declined') {
        void sendCriticalEmail(
          supabase,
          {
            to: recipient,
            ...bookingRejectionEmail({
              userName,
              bookingRef: bookingRef,
              facilityName,
              bookingDate,
              startTime,
              endTime,
              rejectionReason: reason,
              userRole,
            }),
          },
          { sourceType: 'booking_decision', sourceId: bookingId }
        )
      }

      // L2: only 'flagged' gets an immediate admin email — it's the one decision
      // that needs action now. auto_approved/auto_declined are informational and
      // already fanned out in-app to admins above (sendNotificationToRoles, in
      // makeDecision — every decision, not just flagged); emailing every single
      // one of those was inbox noise with no action attached to it. They're rolled
      // up into an hourly digest instead — see the pending-approval-sla cron.
      if (decision === 'flagged') {
        const { data: roleUsers } = await supabase
          .from('user_roles')
          .select('user_id, roles!inner(name)')
          .in('roles.name', ['building_admin', 'academic_head', 'program_head'])
          .eq('is_active', true)

        if (roleUsers && roleUsers.length > 0) {
          const adminUserIds = [...new Set((roleUsers as Array<{ user_id: string }>).map(r => r.user_id))]
          const { data: adminUserRows } = await supabase
            .from('users')
            .select('email, notification_email')
            .in('id', adminUserIds)

          if (adminUserRows) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
            const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
            // Only send to users who have an explicit notification_email set.
            // System/Entra accounts (e.g. @tenant.onmicrosoft.com) have no
            // notification_email and are intentionally excluded.
            const uniqueAdminEmails = [
              ...new Set(
                (adminUserRows as Array<{ email: string; notification_email?: string | null }>)
                  .map(u => u.notification_email)
                  .filter(Boolean) as string[]
              ),
            ]

            const commonPayload = {
              bookingRef,
              submittedBy: userName,
              userEmail: recipient,
              facilityName,
              bookingDate,
              startTime,
              endTime,
              duration: durationStr,
              purpose,
              eventName,
              adminPanelUrl: `${appUrl}/admin/building/reservations`,
              submittedAt: now,
              userRole,
            }

            // Only reachable when decision === 'flagged' (see the guard above).
            const emailContent = adminPendingBookingEmail(commonPayload)

            for (const adminEmail of uniqueAdminEmails) {
              void sendBrevoEmail({ to: adminEmail, ...emailContent })
            }
          }
        }
      }
    } catch (emailErr) {
      console.error('[autoDecisionRouter] Email send error:', emailErr instanceof Error ? emailErr.message : emailErr)
    }
  })()

  return {
    status: decision,
    oversight_expires_at: oversightExpiresAt,
    reason,
    decision_id: decisionRow?.id ?? '',
  }
}

// =====================================================
// Notification helpers
// =====================================================

interface NotificationPayload {
  user_id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  source_type?: string
  source_id?: string
  priority?: string
  action_url?: string
  metadata?: Record<string, unknown>
}

export async function sendNotification(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: payload.user_id,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    source_type: payload.source_type ?? null,
    source_id: payload.source_id ?? null,
    priority: payload.priority ?? 'normal',
    action_url: payload.action_url ?? null,
    metadata: payload.metadata ?? null,
    read: false,
  })

  if (error) {
    console.error('[sendNotification] Failed:', error.message)
  }
}

export async function sendNotificationToRoles(
  supabase: SupabaseClient,
  roleNames: string[],
  payload: Omit<NotificationPayload, 'user_id'>
): Promise<void> {
  const { data: users, error } = await supabase
    .from('user_roles')
    .select('user_id, roles!inner(name)')
    .in('roles.name', roleNames)
    .eq('is_active', true)

  if (error || !users) return

  const uniqueUserIds = [...new Set((users as Array<{ user_id: string }>).map((u) => u.user_id))]

  await Promise.all(
    uniqueUserIds.map((userId) =>
      sendNotification(supabase, { ...payload, user_id: userId })
    )
  )
}
