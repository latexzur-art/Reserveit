/**
 * Booking Score Preview
 *
 * Runs the REAL hard-constraint + soft-scoring engines against a booking that
 * has NOT been inserted yet, so the chatbot / form can show the exact grade the
 * pipeline would produce on submit (auto-approve at >= SCORING_THRESHOLDS.AUTO_APPROVE).
 *
 * This is safe because neither engine queries *by* booking_id — `calculateScore`
 * only reads user/facility/course history, and `checkHardConstraints` uses
 * `.neq('booking_id', id)` (a sentinel id simply excludes nothing). Both are
 * read-only; nothing is written.
 *
 * @module backend/booking/scorePreview
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookingContext, BookingPurpose, ScoreAdjustment } from './booking.types'
import { SCORING_THRESHOLDS } from './booking.types'
import { checkHardConstraints } from './hardConstraintChecker'
import { calculateScore } from './softScoringEngine'

const PREVIEW_BOOKING_ID = '00000000-0000-0000-0000-000000000000'

/** Collected booking fields from the chatbot / quick-fill flow (all optional). */
export interface PreviewFields {
  facility_id: string | null
  booking_date: string | null
  start_time: string | null
  end_time: string | null
  booking_purpose: string | null
  expected_attendees?: number | null
  purpose?: string | null
  event_name?: string | null
  special_requests?: string | null
  facility_purpose_category?: string | null
  mismatch_justification?: string | null
  booking_course_code?: string | null
  booking_department_code?: string | null
  session_type?: 'lecture' | 'lab' | null
}

/** Minimal user profile shape (matches `getAuthUserWithRoles()` result). */
export interface PreviewUserProfile {
  id: string
  user_type: string
  account_status?: string
  roles?: Array<{ name: string }>
  department?: { id: string; code: string; name: string } | null
}

export type ScorePreviewResult =
  | { status: 'insufficient'; missing: string[] }
  | { status: 'hard_fail'; failedCode: string; message: string; reroutable: boolean }
  | {
      status: 'scored'
      score: number
      willAutoApprove: boolean
      willFlag: boolean
      willDecline: boolean
      autoApproveThreshold: number
      adjustments: ScoreAdjustment[]
    }

const VALID_PURPOSES: BookingPurpose[] = [
  'academic', 'school_event', 'department_use', 'personal', 'commercial', 'community',
]

/**
 * Compute the authoritative pre-submit grade for a prospective booking.
 * Returns `insufficient` when the core fields needed to score are missing.
 */
export async function previewBookingScore(
  supabase: SupabaseClient,
  userProfile: PreviewUserProfile,
  fields: PreviewFields
): Promise<ScorePreviewResult> {
  // Both engines need facility + date + a valid time window + purpose.
  const missing: string[] = []
  if (!fields.facility_id) missing.push('facility_id')
  if (!fields.booking_date) missing.push('booking_date')
  if (!fields.start_time) missing.push('start_time')
  if (!fields.end_time) missing.push('end_time')
  if (!fields.booking_purpose || !VALID_PURPOSES.includes(fields.booking_purpose as BookingPurpose)) {
    missing.push('booking_purpose')
  }
  if (missing.length) return { status: 'insufficient', missing }

  const userRoles = (userProfile.roles ?? []).map((r) => r.name)

  const context: BookingContext = {
    booking_id: PREVIEW_BOOKING_ID,
    // Preview doesn't run checkBookingConflict (see scorePreview vs calculateScore
    // note in the audit plan) — a synthetic "now" just satisfies the type.
    created_at: new Date().toISOString(),
    user_id: userProfile.id,
    user_type: userProfile.user_type === 'external' ? 'external' : 'internal',
    user_roles: userRoles,
    account_status: userProfile.account_status ?? 'active',
    user_department_id: userProfile.department?.id ?? null,
    user_department_code: userProfile.department?.code ?? null,
    facility_id: fields.facility_id as string,
    booking_date: fields.booking_date as string,
    start_time: fields.start_time as string,
    end_time: fields.end_time as string,
    booking_purpose: fields.booking_purpose as BookingPurpose,
    purpose: fields.purpose ?? '',
    event_name: fields.event_name ?? undefined,
    expected_attendees: fields.expected_attendees ?? undefined,
    special_requests: fields.special_requests ?? undefined,
    equipment_ids: [],
    self_facilitation_confirmed: false,
    facilitator_name: undefined,
    time_slot_id: undefined,
    facility_purpose_category: fields.facility_purpose_category ?? null,
    mismatch_justification: fields.mismatch_justification ?? null,
    booking_course_code: fields.booking_course_code ?? null,
    booking_department_code: fields.booking_department_code ?? null,
    session_type: fields.session_type ?? null,
  }

  // STEP 1 — Hard constraints (identical to the live pipeline).
  const hard = await checkHardConstraints(supabase, context)
  if (!hard.passed) {
    return {
      status: 'hard_fail',
      failedCode: hard.failed_code ?? 'UNKNOWN',
      message: hard.message ?? 'This booking violates a booking policy.',
      reroutable: hard.is_reroutable ?? false,
    }
  }

  // STEP 2 — Soft score (identical to the live pipeline).
  const scoring = await calculateScore(supabase, context)
  const score = scoring.final_score

  return {
    status: 'scored',
    score,
    willAutoApprove: score >= SCORING_THRESHOLDS.AUTO_APPROVE,
    willFlag: score >= SCORING_THRESHOLDS.FLAG_MIN && score < SCORING_THRESHOLDS.AUTO_APPROVE,
    willDecline: score < SCORING_THRESHOLDS.AUTO_DECLINE_BELOW,
    autoApproveThreshold: SCORING_THRESHOLDS.AUTO_APPROVE,
    adjustments: scoring.adjustments,
  }
}
