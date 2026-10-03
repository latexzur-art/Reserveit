/**
 * Soft Scoring Engine
 * Calculates a 0-100 score based on contextual soft constraints.
 * All constraint rules are loaded from the database so they can be
 * adjusted by admins without a code deploy.
 * @module backend/booking/softScoringEngine
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookingContext, ScoringResult, ScoringContext, ScoreAdjustment } from './booking.types'
import { BASE_SCORE } from './booking.types'
import { getManilaNow } from '@/lib/timezone'
import { cacheGet, cacheSet, TTL_24H, TTL_12H } from '@/lib/cache'

export async function calculateScore(
  supabase: SupabaseClient,
  booking: BookingContext
): Promise<ScoringResult> {
  const context = await buildScoringContext(supabase, booking)

  // Load soft scoring rules (cached for 24h — rules rarely change)
  const SOFT_RULES_KEY = 'booking:soft_rules'
  type SoftRule = { code: string; name: string; point_value: number; condition_field: string; condition_operator: string; condition_value: string }

  let rules: SoftRule[] | null = cacheGet<SoftRule[]>(SOFT_RULES_KEY) ?? null
  if (!rules) {
    const { data, error } = await supabase
      .from('approval_constraint_rules')
      .select('code, name, point_value, condition_field, condition_operator, condition_value')
      .eq('constraint_type', 'soft')
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error) throw new Error(`Failed to load soft constraint rules: ${error.message}`)
    rules = data ?? []
    cacheSet(SOFT_RULES_KEY, rules, TTL_24H)
  }

  const adjustments: ScoreAdjustment[] = []

  for (const rule of rules ?? []) {
    if (!rule.condition_field || !rule.condition_operator) continue

    const matches = evaluateCondition(
      rule.condition_field,
      rule.condition_operator,
      rule.condition_value,
      context
    )

    if (matches) {
      adjustments.push({
        code: rule.code,
        name: rule.name,
        points: rule.point_value,
        reason: buildReason(rule.code, context),
      })
    }
  }

  // ─── Facility Affinity: Course-based OR Department-based (never both) ───
  if (context.booking_course_code) {
    // When a course is specified, use course-facility affinity ONLY.
    // This prevents double-dipping (e.g., BSIT faculty selecting BSIT
    // would otherwise get both dept + course bonuses for the same signal).
    const courseAffinityResult = await evaluateCourseFacilityAffinity(supabase, context)
    if (courseAffinityResult.matched && courseAffinityResult.points > 0) {
      adjustments.push({
        code: 'COURSE_FACILITY_AFFINITY',
        name: 'Course-Facility Match',
        points: courseAffinityResult.points,
        reason: courseAffinityResult.reason,
      })
    }
  } else {
    // No course specified → fall back to existing department affinity logic
    const deptAffinityResult = evaluateDepartmentAffinity(context)
    if (deptAffinityResult.matched && deptAffinityResult.points > 0) {
      adjustments.push({
        code: 'DEPT_FACILITY_AFFINITY',
        name: 'Department-Facility Affinity',
        points: deptAffinityResult.points,
        reason: deptAffinityResult.reason,
      })
    }
  }

  // Mismatch Justification Weights (for specialized rooms)
  // F13 fix: gated on EXACT preset-sentence identity, not substring/keyword
  // matching — see AUTO_APPROVE_ELIGIBLE_REASONS in facilityMismatchChecker.ts
  // for why substring `.includes()` was a self-service score-inflation bypass.
  if (booking.mismatch_justification) {
    const text = booking.mismatch_justification.trim().toLowerCase()

    if (text === 'requires specialized equipment in this facility') {
      adjustments.push({ code: 'MISMATCH_WEIGHT_EQUIPMENT', name: 'Priority: Specialized Equipment', points: 15, reason: 'High-priority technical requirement' })
    } else if (text === 'lab or practical exam requirement') {
      adjustments.push({ code: 'MISMATCH_WEIGHT_EXAM', name: 'Priority: Academic Exam', points: 10, reason: 'High-priority academic requirement' })
    } else if (text === 'cross-department collaboration or joint class' || text === 'faculty exchange or guest lecture') {
      adjustments.push({ code: 'MISMATCH_WEIGHT_COLLAB', name: 'Priority: Collaborative Class', points: 5, reason: 'Cross-department academic effort' })
    } else if (text && text !== '— select a reason —') {
      // Custom or Administrative reason (free text via "Other", or an admin/logistics preset)
      adjustments.push({ code: 'MISMATCH_WEIGHT_GENERIC', name: 'Priority: Administrative/Generic', points: -5, reason: 'Standard administrative request (needs scrutiny)' })
    }
  }

  // Justification bonus: recognized justification types get a boost (Event Details section)
  const KNOWN_JUSTIFICATIONS = [
    'makeup_class', 'lab_activity', 'faculty_meeting', 'student_consultation',
    'thesis_defense', 'review_session', 'research_activity', 'org_event', 'seminar_workshop',
  ]
  if (booking.event_name && KNOWN_JUSTIFICATIONS.includes(booking.event_name.toLowerCase())) {
    adjustments.push({
      code: 'HAS_JUSTIFICATION',
      name: 'Booking Justification Provided',
      points: 10,
      reason: `Justification: ${booking.event_name}`,
    })
  }

  // Detailed purpose bonus: longer, more descriptive purposes get a small boost
  if (booking.purpose && booking.purpose.trim().length >= 20) {
    adjustments.push({
      code: 'DETAILED_PURPOSE',
      name: 'Detailed Purpose Description',
      points: 5,
      reason: `Purpose description is ${booking.purpose.trim().length} characters`,
    })
  }

  const totalAdjustment = adjustments.reduce((sum, a) => sum + a.points, 0)
  const finalScore = Math.max(0, Math.min(100, BASE_SCORE + totalAdjustment))

  return {
    base_score: BASE_SCORE,
    adjustments,
    final_score: finalScore,
  }
}

// =====================================================
// Context builder
// =====================================================

async function buildScoringContext(
  supabase: SupabaseClient,
  booking: BookingContext
): Promise<ScoringContext> {
  // TZ fix: getManilaNow() encodes Manila wall-clock into the Date's UTC fields (see
  // lib/timezone.ts), so it must be zeroed with setUTCHours, not the runtime-local
  // setHours — the old .setHours(0,0,0,0) only zeroed correctly by accident on a
  // UTC-configured runtime (Vercel); on a runtime set to Asia/Manila local time it
  // would zero at local-interpreted midnight of an already-shifted instant, silently
  // shifting days_until_booking by a day near the boundary.
  const today = getManilaNow()
  today.setUTCHours(0, 0, 0, 0)
  const bookingDate = new Date(booking.booking_date)
  const daysUntilBooking = Math.floor((bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const startHour = parseInt(booking.start_time.split(':')[0])
  const startMinutes = parseInt(booking.start_time.split(':')[0]) * 60 + parseInt(booking.start_time.split(':')[1])
  const endMinutes = parseInt(booking.end_time.split(':')[0]) * 60 + parseInt(booking.end_time.split(':')[1])
  const durationHours = (endMinutes - startMinutes) / 60
  // TZ fix: booking_date is a pure calendar date parsed as UTC midnight — read it
  // with getUTCDay(), not the runtime-local getDay(), so day-of-week is correct
  // regardless of the server's own timezone.
  const dayOfWeek = bookingDate.getUTCDay()

  // P2-2: score aging. The cancellation_rate is computed over the last 90 days
  // rather than lifetime, so a user who had a bad semester two years ago isn't
  // permanently penalized. A minimum sample size prevents a single recent
  // cancellation from spiking the rate to 100%.
  const HISTORY_WINDOW_DAYS = 90
  const MIN_SAMPLE_FOR_RATE = 3
  const windowStart = new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: userBookingsAllTime }, { data: lastReset }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, current_status, cancellation_type, created_at')
      .eq('user_id', booking.user_id)
      .neq('current_status', 'pending'),
    supabase
      .from('restriction_logs')
      .select('created_at')
      .eq('user_id', booking.user_id)
      .in('action', ['score_reset', 'score_reset_bulk'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // booking_count remains lifetime — it represents experience, not behavior.
  const totalBookings = (userBookingsAllTime ?? []).length

  // Cancellation rate is windowed. If the user had an approved reset, only
  // count cancellations that occurred after the reset date.
  const resetAt = lastReset ? (lastReset as { created_at: string }).created_at : null
  const effectiveWindowStart = resetAt && resetAt > windowStart ? resetAt : windowStart

  const recentBookings = (userBookingsAllTime ?? []).filter(
    (b: any) => b.created_at && b.created_at >= effectiveWindowStart
  )
  // Exclude admin-initiated or non-fault cancellations from the rate:
  // - admin_cancelled: cancelled by building admin or academic head
  // - alternative_declined: faculty declined a proposed schedule change (admin proposed it)
  // - force_majeure: admin cancelled a paid booking (credit was issued)
  const EXCLUDED_CANCELLATION_TYPES = new Set(['admin_cancelled', 'alternative_declined', 'force_majeure'])
  const recentCancelled = recentBookings.filter(
    (b: any) =>
      (b.current_status === 'cancelled' || b.current_status === 'auto_declined') &&
      !EXCLUDED_CANCELLATION_TYPES.has(b.cancellation_type)
  ).length
  const cancellationRate =
    recentBookings.length >= MIN_SAMPLE_FOR_RATE
      ? recentCancelled / recentBookings.length
      : 0

  // P1-3: actually check unpaid balance via the payments table.
  // A user has an unpaid balance if any of their booking payments are still
  // pending/processing (not completed, not cancelled, not failed).
  const { data: unpaidPayments } = await supabase
    .from('payments')
    .select('id')
    .eq('user_id', booking.user_id)
    .in('payment_status', ['pending', 'processing'])
    .limit(1)
  // Internal users are exempt from the unpaid balance penalty
  const hasUnpaidBalance = booking.user_type !== 'internal' && (unpaidPayments?.length ?? 0) > 0

  // P1-3: violation count = number of times the user has been restricted
  // (auto or manual). Restriction lifts don't subtract — the event happened.
  const { count: violationCountRaw } = await supabase
    .from('restriction_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', booking.user_id)
    .in('action', ['auto_restricted', 'manually_restricted'])
  const violationCount = violationCountRaw ?? 0

  // Fetch facility info
  const { data: facility } = await supabase
    .from('facilities')
    .select('facility_tier, facility_types!inner(name)')
    .eq('id', booking.facility_id)
    .single()

  const facilityTier = facility?.facility_tier ?? 'standard'
  const facilityTypeName = ((facility as Record<string, Record<string, string>> | null)?.facility_types?.name ?? '').toLowerCase()

  // Check academic term status (cached for 12h — changes only at semester turnover)
  const TERM_KEY = 'booking:active_term'
  type ActiveTerm = {
    exam_start_date: string | null; exam_end_date: string | null
    enrollment_start_date: string | null; enrollment_end_date: string | null
    break_start_date: string | null; break_end_date: string | null
  }

  // undefined = cache miss; null = cached "no active term"
  let currentTerm: ActiveTerm | null | undefined = cacheGet<ActiveTerm | null>(TERM_KEY)
  if (currentTerm === undefined) {
    const { data } = await supabase
      .from('academic_terms')
      .select('exam_start_date, exam_end_date, enrollment_start_date, enrollment_end_date, break_start_date, break_end_date')
      .eq('is_active', true)
      .single()
    currentTerm = data ?? null
    cacheSet(TERM_KEY, currentTerm, TTL_12H)
  }

  let isExamPeriod = false
  let isEnrollmentPeriod = false
  let isSemesterBreak = false

  if (currentTerm) {
    const d = booking.booking_date
    isExamPeriod = !!currentTerm.exam_start_date && !!currentTerm.exam_end_date && d >= currentTerm.exam_start_date && d <= currentTerm.exam_end_date
    isEnrollmentPeriod = !!currentTerm.enrollment_start_date && !!currentTerm.enrollment_end_date && d >= currentTerm.enrollment_start_date && d <= currentTerm.enrollment_end_date
    isSemesterBreak = !!currentTerm.break_start_date && d >= currentTerm.break_start_date && d <= (currentTerm.break_end_date ?? d)
  }

  // Lookup course delivery_mode and compute session_facility_match
  let courseDeliveryMode: 'lecture' | 'lab' | 'both' | null = null
  let sessionFacilityMatch: 'lab_in_lecture' | 'lecture_in_lab' | 'correct_match' | null = null
  const sessionType = booking.session_type ?? null
  const bookingDeptCode = booking.booking_department_code ?? null

  if (booking.booking_course_code && bookingDeptCode) {
    const { data: course } = await supabase
      .from('courses')
      .select('delivery_mode')
      .eq('course_code', booking.booking_course_code)
      .eq('department_code', bookingDeptCode)
      .eq('approval_status', 'approved')
      .single()

    if (course) {
      courseDeliveryMode = course.delivery_mode as typeof courseDeliveryMode

      if (sessionType) {
        // Get facility tags to determine if it's a lab
        const { data: fTags } = await supabase
          .from('facility_purpose_tags')
          .select('tag')
          .eq('facility_id', booking.facility_id)

        const facilityHasLabTag = (fTags ?? []).some(
          (t: { tag: string }) => ['computer_use', 'science_lab', 'hospitality_lab'].includes(t.tag)
        )

        if (sessionType === 'lab' && !facilityHasLabTag) {
          sessionFacilityMatch = 'lab_in_lecture'
        } else if (sessionType === 'lecture' && facilityHasLabTag) {
          sessionFacilityMatch = 'lecture_in_lab'
        } else if (courseDeliveryMode === 'both') {
          // Correct match: session type aligns with facility type
          sessionFacilityMatch = 'correct_match'
        }
      }
    }
  }

  return {
    user_type: booking.user_type,
    user_roles: booking.user_roles,
    booking_count: totalBookings,
    cancellation_rate: cancellationRate,
    violation_count: violationCount,
    has_unpaid_balance: hasUnpaidBalance,
    booking_purpose: booking.booking_purpose,
    booking_day_of_week: dayOfWeek,
    start_time_hour: startHour,
    booking_duration_hours: durationHours,
    days_until_booking: daysUntilBooking,
    facility_id: booking.facility_id,
    facility_tier: facilityTier,
    facility_type_name: facilityTypeName,
    equipment_count: booking.equipment_ids?.length ?? 0,
    is_exam_period: isExamPeriod,
    is_enrollment_period: isEnrollmentPeriod,
    is_semester_break: isSemesterBreak,
    user_department_code: booking.user_department_code,
    user_department_id: booking.user_department_id,
    booking_course_code: booking.booking_course_code ?? null,
    booking_department_code: bookingDeptCode,
    session_type: sessionType,
    course_delivery_mode: courseDeliveryMode,
    session_facility_match: sessionFacilityMatch,
  }
}

// =====================================================
// Condition evaluator
// =====================================================

function evaluateCondition(
  field: string,
  operator: string,
  value: string | null,
  context: ScoringContext
): boolean {
  const contextValue = getContextValue(field, context)
  if (contextValue === undefined || contextValue === null) return false

  // Normalize for case-insensitive string comparisons
  const normalize = (v: unknown) => String(v).toLowerCase().trim()

  switch (operator) {
    case 'equals':
      // Support array context values (e.g., user_roles): match if ANY element equals
      if (Array.isArray(contextValue)) {
        return (contextValue as string[]).some((cv) => normalize(cv) === normalize(value))
      }
      return normalize(contextValue) === normalize(value)
    case 'not_equals':
      if (Array.isArray(contextValue)) {
        return !(contextValue as string[]).some((cv) => normalize(cv) === normalize(value))
      }
      return normalize(contextValue) !== normalize(value)
    case 'greater_than':
      return Number(contextValue) > Number(value)
    case 'less_than':
      return Number(contextValue) < Number(value)
    case 'greater_than_or_equal':
      return Number(contextValue) >= Number(value)
    case 'less_than_or_equal':
      return Number(contextValue) <= Number(value)
    case 'in': {
      const values = (value ?? '').split(',').map((v) => normalize(v))
      if (Array.isArray(contextValue)) {
        return (contextValue as string[]).some((cv) => values.includes(normalize(cv)))
      }
      return values.includes(normalize(contextValue))
    }
    case 'not_in': {
      const values = (value ?? '').split(',').map((v) => normalize(v))
      if (Array.isArray(contextValue)) {
        return !(contextValue as string[]).some((cv) => values.includes(normalize(cv)))
      }
      return !values.includes(normalize(contextValue))
    }
    case 'contains':
      return normalize(contextValue).includes(normalize(value))
    default:
      return false
  }
}

function getContextValue(field: string, context: ScoringContext): unknown {
  switch (field) {
    case 'user_type': return context.user_type
    case 'user_role': return context.user_roles
    case 'booking_count': return context.booking_count
    case 'cancellation_rate': return context.cancellation_rate
    case 'violation_count': return context.violation_count
    case 'has_unpaid_balance': return String(context.has_unpaid_balance)
    case 'booking_purpose': return context.booking_purpose
    case 'booking_day_of_week': return context.booking_day_of_week
    case 'start_time_hour': return context.start_time_hour
    case 'booking_duration_hours': return context.booking_duration_hours
    case 'days_until_booking': return context.days_until_booking
    case 'facility_tier': return context.facility_tier
    case 'facility_type_name': return context.facility_type_name
    case 'equipment_count': return context.equipment_count
    case 'is_exam_period': return String(context.is_exam_period)
    case 'is_enrollment_period': return String(context.is_enrollment_period)
    case 'is_semester_break': return String(context.is_semester_break)
    case 'session_type': return context.session_type
    case 'course_delivery_mode': return context.course_delivery_mode
    case 'session_facility_match': return context.session_facility_match
    default: return undefined
  }
}

// =====================================================
// Reason builder
// =====================================================

function buildReason(code: string, context: ScoringContext): string {
  const reasons: Record<string, string> = {
    REQ_FACULTY: 'Faculty member booking',
    REQ_PROGRAM_HEAD: 'Program Head priority booking',
    REQ_EXTERNAL: 'External client booking',
    REQ_FIRST_TIME: `First-time user (${context.booking_count} previous bookings)`,
    REQ_EXPERIENCED: `Experienced user (${context.booking_count} previous bookings)`,
    REQ_HIGH_CANCEL: `High cancellation rate (${Math.round(context.cancellation_rate * 100)}%)`,
    REQ_VIOLATIONS: `User has ${context.violation_count} previous violation(s)`,
    REQ_UNPAID: 'Unpaid balance on account',
    BOOK_ACADEMIC: 'Academic purpose',
    BOOK_COMMERCIAL: 'Commercial purpose',
    BOOK_WEEKEND: 'Weekend booking',
    BOOK_EVENING: `Evening booking (${context.start_time_hour}:00)`,
    BOOK_LONG: `Long duration (${context.booking_duration_hours.toFixed(1)} hours)`,
    BOOK_SAME_DAY: 'Same-day booking',
    FAC_STANDARD: 'Standard-tier facility',
    FAC_PREMIUM: 'Premium-tier facility',
    FAC_LAB: 'Laboratory facility',
    FAC_HIGH_EQUIP: `High equipment count (${context.equipment_count} items)`,
    TEMP_EXAM: 'Booking during exam period',
    TEMP_ENROLLMENT: 'Booking during enrollment period',
    TEMP_BREAK: 'Booking during semester break',
    SESSION_LAB_IN_LECTURE: 'Lab session booked in a lecture room without lab equipment',
    SESSION_LECTURE_IN_LAB: 'Lecture session booked in a lab — forces manual review',
    SESSION_MATCH_BONUS: 'Correct session-facility match for dual delivery mode course',
  }
  return reasons[code] ?? code
}

// =====================================================
// Department-Facility Affinity Evaluator
// =====================================================

/**
 * Evaluates department-facility affinity for smart approval.
 * Only applies to Computer Labs (BSIT/BSCS students get +15 bonus).
 * Science labs are open to all (no affinity logic per user request).
 * @returns {matched: boolean, reason: string, points: number}
 */
function evaluateDepartmentAffinity(
  context: ScoringContext
): { matched: boolean; reason: string; points: number } {
  const deptCode = context.user_department_code
  const facilityType = context.facility_type_name

  // External users or no department → neutral (no bonus/penalty)
  if (!deptCode) {
    return { matched: false, reason: 'No department info available', points: 0 }
  }

  // Computer Labs: BSIT, BSCS get +15 bonus
  if (facilityType === 'computer_lab') {
    if (['BSIT', 'BSCS'].includes(deptCode)) {
      return {
        matched: true,
        reason: `${deptCode} students have primary access to computer labs`,
        points: 15,
      }
    }
    // Other departments: neutral (allowed, just no bonus)
    return {
      matched: false,
      reason: 'Computer lab available to all departments',
      points: 0,
    }
  }

  // Science Labs: Open to all departments (no affinity logic)
  // Classrooms, Conference Rooms, etc.: Open to all
  return { matched: false, reason: 'General-purpose facility', points: 0 }
}

// =====================================================
// Course-Facility Affinity Evaluator
// =====================================================

/**
 * Evaluates course-facility affinity for smart approval.
 * Awards bonus points when the booking course matches the facility's specialization tags.
 * Uses the course_facility_affinity table which maps courses to facility tags.
 * e.g., BSIT course + computer_use tag → +15 points
 *
 * @param supabase - Supabase client for database queries
 * @param context - Scoring context with booking details
 * @returns Promise resolving to {matched: boolean, reason: string, points: number}
 */
async function evaluateCourseFacilityAffinity(
  supabase: SupabaseClient,
  context: ScoringContext
): Promise<{ matched: boolean; points: number; reason: string }> {
  // Skip if no course selected
  if (!context.booking_course_code) {
    return { matched: false, points: 0, reason: 'No course specified' }
  }

  // Get facility tags for the booked facility
  const { data: facilityTags } = await supabase
    .from('facility_purpose_tags')
    .select('tag')
    .eq('facility_id', context.facility_id)

  if (!facilityTags || facilityTags.length === 0) {
    return { matched: false, points: 0, reason: 'Facility has no specialization tags' }
  }

  // Check for course-facility affinity match
  const tags = facilityTags.map((t: { tag: string }) => t.tag)
  const { data: affinity } = await supabase
    .from('course_facility_affinity')
    .select('facility_tag, affinity_points, notes')
    .eq('course_code', context.booking_course_code)
    .in('facility_tag', tags)
    .maybeSingle()

  if (affinity) {
    return {
      matched: true,
      points: affinity.affinity_points,
      reason: `${context.booking_course_code} course matches ${affinity.facility_tag} facility`
    }
  }

  return { matched: false, points: 0, reason: 'No affinity match found' }
}
