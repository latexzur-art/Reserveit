/**
 * Facility-Purpose Mismatch Checker
 * Detects when a faculty member books a specialized facility
 * (computer lab, AV studio) for a purpose that is not whitelisted
 * for their department. Unrecognized cross-department uses are
 * routed to the Academic Head for manual review.
 *
 * Logic:
 * 1. External users / no department → no mismatch (skip)
 * 2. User's dept = facility's primary_department_id → no mismatch (skip)
 * 3. Facility has no specialized tags → no mismatch (general-purpose room)
 * 4. Dept+tag combo is in department_facility_exceptions AND the submitted
 *    facility_purpose_category is in the allowed list → whitelisted (no penalty)
 * 5. Otherwise → UNRECOGNIZED_CROSS_DEPT_USE: force manual review by academic_head
 *
 * @module backend/booking/facilityMismatchChecker
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type MismatchFlag =
  | 'CROSS_DEPT_EXCEPTION_MATCHED'
  | 'UNRECOGNIZED_CROSS_DEPT_USE'
  | 'COURSE_FACILITY_MATCH'
  | 'SESSION_LECTURE_IN_LAB_MISMATCH'  // Lecture session in lab facility → forced AH review
  | null

export interface MismatchCheckResult {
  hasMismatch: boolean
  flag: MismatchFlag
  forceManualReview: boolean
  scorePenalty: number
  requiresJustification: boolean
  reviewerRole: 'academic_head' | null
  userMessage: string | null    // Shown on booking form if justification is needed
  adminMessage: string | null   // Shown on Academic Head review card
}

// F13 fix: eligibility for auto-approve (skip forced Academic Head review) must be
// gated on an EXACT match against a known preset reason sentence, never on
// substring/keyword presence in free text. The old `.includes('specialized
// equipment')` check let a user select "Other" and free-type any text containing
// that phrase to both skip mandatory review AND cut the score penalty — a
// self-service bypass of the AH gate. These strings must stay byte-identical to
// the `value`s in components/bookings/form/constants.ts MISMATCH_REASONS.
const AUTO_APPROVE_ELIGIBLE_REASONS = new Set([
  'requires specialized equipment in this facility',
  'lab or practical exam requirement',
  'cross-department collaboration or joint class',
])

const NO_MISMATCH: MismatchCheckResult = {
  hasMismatch: false,
  flag: null,
  forceManualReview: false,
  scorePenalty: 0,
  requiresJustification: false,
  reviewerRole: null,
  userMessage: null,
  adminMessage: null,
}

export async function checkFacilityPurposeMismatch(
  supabase: SupabaseClient,
  params: {
    facilityId: string
    departmentId: string | null
    facilityPurposeCategory: string | null
    justificationText: string | null
    bookingCourseCode?: string | null
    sessionType?: 'lecture' | 'lab' | null  // NEW: Session type for session-facility mismatch
  }
): Promise<MismatchCheckResult> {
  const { facilityId, departmentId, facilityPurposeCategory, justificationText } = params

  // External users or users with no department → skip mismatch logic
  if (!departmentId) return NO_MISMATCH

  // Step 1: Check if this user's department is the primary department for this facility
  // F-mismatch: log query errors instead of silently swallowing them. A failed lookup
  // here still falls through toward "treat as cross-department" (fails toward more
  // review, not less — same safe-ish direction as before), but previously gave no
  // signal that the *reason* was a DB error rather than a genuine cross-dept booking.
  const { data: facility, error: facilityError } = await supabase
    .from('facilities')
    .select('primary_department_id')
    .eq('id', facilityId)
    .single()

  if (facilityError) {
    console.error('[facilityMismatchChecker] primary_department_id lookup failed:', facilityError.message)
  }

  if (facility?.primary_department_id === departmentId) {
    return NO_MISMATCH
  }

  // NEW: Check if booking course has affinity with facility
  // This allows cross-dept teaching (e.g., BSHM faculty teaching BSIT elective in computer lab)
  if (params.bookingCourseCode) {
    // Get facility tags
    const { data: facilityTags } = await supabase
      .from('facility_purpose_tags')
      .select('tag')
      .eq('facility_id', facilityId)

    if (facilityTags && facilityTags.length > 0) {
      const tags = facilityTags.map((t: { tag: string }) => t.tag)

      // Check if the course has affinity with any of the facility's tags
      const { data: affinity } = await supabase
        .from('course_facility_affinity')
        .select('facility_tag')
        .eq('course_code', params.bookingCourseCode)
        .in('facility_tag', tags)
        .maybeSingle()

      // If course matches facility specialization, no mismatch
      if (affinity) {
        return {
          hasMismatch: false,
          flag: 'COURSE_FACILITY_MATCH',  // NEW flag value
          forceManualReview: false,
          scorePenalty: 0,
          requiresJustification: false,
          reviewerRole: null,
          userMessage: null,
          adminMessage: null,
        }
      }
    }
  }

  // Session-type mismatch check: lecture session in a lab facility → forced AH review
  if (params.sessionType === 'lecture') {
    const { data: labTags } = await supabase
      .from('facility_purpose_tags')
      .select('tag')
      .eq('facility_id', facilityId)
      .in('tag', ['computer_use', 'science_lab', 'hospitality_lab'])

    if (labTags && labTags.length > 0) {
      return {
        hasMismatch: true,
        flag: 'SESSION_LECTURE_IN_LAB_MISMATCH',
        forceManualReview: true,
        scorePenalty: 0, // Scoring handled by SESSION_LECTURE_IN_LAB rule (-15)
        requiresJustification: false,
        reviewerRole: 'academic_head',
        userMessage: 'You selected a lecture session but chose a lab facility. This booking will require Academic Head review.',
        adminMessage: 'Lecture session booked in a lab facility. Please verify this is intentional.',
      }
    }
  }

  // Step 2: Get facility's purpose tags to determine if it's specialized
  const { data: tags } = await supabase
    .from('facility_purpose_tags')
    .select('tag')
    .eq('facility_id', facilityId)

  const facilityTags = tags?.map((t: { tag: string }) => t.tag) ?? []
  const specializedTag = facilityTags.find((t: string) =>
    ['computer_use', 'science_lab', 'av_studio', 'gym', 'hospitality_lab', 'multipurpose', 'conference'].includes(t)
  )

  // Not a specialized facility → no mismatch logic applies
  if (!specializedTag) return NO_MISMATCH

  // Step 3: Check whitelist — is this department allowed to use this facility type?
  // F-mismatch: same rationale as the Step 1 lookup above — log so a whitelist that
  // silently stops applying (DB error, not a real policy change) is visible instead
  // of just quietly over-flagging every booking from that department.
  const { data: exception, error: exceptionError } = await supabase
    .from('department_facility_exceptions')
    .select('allowed_purpose_categories, auto_approve_eligible')
    .eq('department_id', departmentId)
    .eq('facility_type', specializedTag)
    .single()

  if (exceptionError && exceptionError.code !== 'PGRST116') {
    // PGRST116 = "no rows found", which is the expected/common case (no whitelist
    // exists for this dept+tag combo) — only log genuine query failures.
    console.error('[facilityMismatchChecker] department_facility_exceptions lookup failed:', exceptionError.message)
  }

  if (
    exception &&
    facilityPurposeCategory &&
    (exception.allowed_purpose_categories as string[]).includes(facilityPurposeCategory) &&
    exception.auto_approve_eligible
  ) {
    // Whitelisted — zero impact on scoring, no forced review
    return {
      hasMismatch: false,
      flag: 'CROSS_DEPT_EXCEPTION_MATCHED',
      forceManualReview: false,
      scorePenalty: 0,
      requiresJustification: false,
      reviewerRole: null,
      userMessage: null,
      adminMessage: null,
    }
  }

  // Step 4: Unrecognized cross-department use — apply graduated response
  // Justification is now easier to meet since we use dropdown presets
  const trimmedJustificationRaw = justificationText?.trim() ?? ''
  const trimmedJustification = trimmedJustificationRaw.toLowerCase()
  const hasJustification = trimmedJustification.length >= 10

  // "Smart" Logic: Only high-priority academic/technical needs can bypass mandatory
  // review — and only when the reason is an exact, unmodified preset selection (see
  // AUTO_APPROVE_ELIGIBLE_REASONS above), never a free-text match on a keyword.
  const isAutoApproveEligible = AUTO_APPROVE_ELIGIBLE_REASONS.has(trimmedJustification)

  const facilityTypeLabel = specializedTag.replace('_', ' ')
  const purposeLabel = facilityPurposeCategory ?? 'unspecified purpose'

  return {
    hasMismatch: true,
    flag: 'UNRECOGNIZED_CROSS_DEPT_USE',
    // High-priority academic needs don't force review if justified,
    // allowing the scoring engine to auto-approve if the total score is high.
    // Administrative reasons or "Other" always require human review.
    forceManualReview: !isAutoApproveEligible,
    scorePenalty: hasJustification ? 10 : 25,
    requiresJustification: !hasJustification,
    reviewerRole: 'academic_head',
    userMessage: hasJustification
      ? null
      : `This is a specialized ${facilityTypeLabel} facility. Please explain why your activity requires this specific room.`,
    adminMessage: `Booking flagged: "${purposeLabel}" activity in a ${facilityTypeLabel}. Justification: "${justificationText?.trim() ?? 'none provided'}". Please review or suggest an alternative facility.`,
  }
}
