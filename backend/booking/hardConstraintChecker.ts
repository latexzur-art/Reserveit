/**
 * Hard Constraint Checker
 * Evaluates all active hard constraints for a booking.
 * A single failure immediately stops the check (fail-fast).
 * @module backend/booking/hardConstraintChecker
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookingContext, HardConstraintResult } from './booking.types'
import { getManilaNow, getManilaTodayISO } from '@/lib/timezone'
import { cacheGet, cacheSet, TTL_24H } from '@/lib/cache'
import { earliestBookableDate, DEFAULT_MIN_LEAD_DAYS, MIN_LEAD_DAYS_KEY } from '@/lib/reservation-lead-time'

interface CheckResult {
  passed: boolean
  details?: Record<string, unknown>
}

// F10 fix: a Supabase query error on a safety-critical check (physical conflict,
// maintenance, admin block, term/exam/enrollment window) must fail CLOSED, not
// open — a transient DB error must never silently let a booking through to
// auto-approve over a double-booking, a maintenance window, or an admin block.
// Policy-only checks (advance limit, duration) may still tolerate fail-open.
const VERIFY_FAILED: CheckResult = {
  passed: false,
  details: { reason: 'Could not verify this constraint due to a system error — flagged for manual review.' },
}

export async function checkHardConstraints(
  supabase: SupabaseClient,
  booking: BookingContext
): Promise<HardConstraintResult> {
  // Load all active hard rules ordered by priority (cached for 24h — rules rarely change)
  const HARD_RULES_KEY = 'booking:hard_rules'
  type HardRule = { code: string; applies_to: string; is_reroutable: boolean; rejection_message: string }

  let rules: HardRule[] | null = cacheGet<HardRule[]>(HARD_RULES_KEY) ?? null
  if (!rules) {
    const { data, error } = await supabase
      .from('approval_constraint_rules')
      .select('code, applies_to, is_reroutable, rejection_message')
      .eq('constraint_type', 'hard')
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error) throw new Error(`Failed to load hard constraint rules: ${error.message}`)
    rules = data ?? []
    cacheSet(HARD_RULES_KEY, rules, TTL_24H)
  }

  // Privileged roles (building_admin, academic_head) bypass policy-enforcement constraints.
  // Physical/conflict constraints (booking conflict, maintenance, admin block) still apply.
  const PRIVILEGED_ROLES = new Set(['building_admin', 'academic_head'])
  const PRIVILEGE_BYPASSED = new Set([
    'PURPOSE_MISMATCH',
    'EVENT_IN_CLASSROOM',
    'OUTSIDE_HOURS',
    'ADVANCE_LIMIT',
    'MIN_ADVANCE_NOTICE',
    'DURATION_VIOLATION',
  ])
  const isPrivileged = booking.user_roles?.some(r => PRIVILEGED_ROLES.has(r)) ?? false

  // O1: run every applicable check concurrently instead of one Supabase round-trip
  // at a time. `rules` is already priority-ordered (ascending), so after all checks
  // resolve we pick the FIRST failing one by that same order — the exact rule the
  // old sequential fail-fast loop would have stopped on and reported. Checks are
  // pure reads with no cross-check side effects, so running them out of order and
  // picking the earliest failure afterward is equivalent to fail-fast, just without
  // paying for ~16 serialized round-trips on the (common) approval path.
  const applicableRules = (rules ?? []).filter((rule) => {
    if (rule.applies_to === 'external' && booking.user_type === 'internal') return false
    if (rule.applies_to === 'internal' && booking.user_type === 'external') return false
    if (isPrivileged && PRIVILEGE_BYPASSED.has(rule.code)) return false
    return true
  })

  const checkResults = await Promise.all(
    applicableRules.map((rule) => runHardCheck(supabase, rule.code, booking))
  )

  const allResults: { code: string; passed: boolean }[] = applicableRules.map((rule, i) => ({
    code: rule.code,
    passed: checkResults[i].passed,
  }))

  const firstFailureIndex = checkResults.findIndex((r) => !r.passed)

  if (firstFailureIndex !== -1) {
    const rule = applicableRules[firstFailureIndex]
    const check = checkResults[firstFailureIndex]
    let finalMessage = rule.rejection_message
    if (check.details?.reason) {
      finalMessage = `${rule.rejection_message} Reason: ${check.details.reason}`
    }

    return {
      passed: false,
      failed_code: rule.code,
      is_reroutable: rule.is_reroutable,
      message: finalMessage,
      details: check.details,
      all_results: allResults,
    }
  }

  return { passed: true, all_results: allResults }
}

async function runHardCheck(
  supabase: SupabaseClient,
  code: string,
  booking: BookingContext
): Promise<CheckResult> {
  switch (code) {
    case 'USER_RESTRICTED':
      return checkUserRestricted(supabase, booking.user_id)
    case 'CLASS_CONFLICT':
      return checkClassConflict(supabase, booking)
    case 'SCHOOL_EVENT_BLOCK':
      return checkSchoolEventBlock(supabase, booking)
    case 'BOOKING_CONFLICT':
      return checkBookingConflict(supabase, booking)
    case 'EQUIPMENT_CONFLICT':
      return checkEquipmentConflict(supabase, booking)
    case 'BUFFER_VIOLATION':
      return checkBufferViolation(supabase, booking)
    case 'ADMIN_BLOCK':
      return checkAdminBlock(supabase, booking)
    case 'OUTSIDE_HOURS':
      return checkOutsideHours(supabase, booking)
    case 'CAPACITY_EXCEEDED':
      return checkCapacityExceeded(supabase, booking)
    case 'UNDER_MAINTENANCE':
      return checkUnderMaintenance(supabase, booking)
    case 'FACILITY_CRITICAL_WARNING':
      return checkCriticalWarning(supabase, booking)
    case 'EXAM_PERIOD_BLOCK':
      return checkExamPeriodBlock(supabase, booking)
    case 'ENROLLMENT_BLOCK':
      return checkEnrollmentBlock(supabase, booking)
    case 'OUTSIDE_ACADEMIC_TERM':
      return checkOutsideAcademicTerm(supabase, booking)
    case 'ADVANCE_LIMIT':
      return checkAdvanceLimit(supabase, booking)
    case 'MIN_ADVANCE_NOTICE':
      return checkMinAdvanceNotice(supabase, booking)
    case 'DURATION_VIOLATION':
      return checkDurationViolation(supabase, booking)
    case 'PURPOSE_MISMATCH':
      return checkPurposeMismatch(supabase, booking)
    case 'EVENT_IN_CLASSROOM':
      return checkEventInClassroom(supabase, booking)
    case 'RESTRICTED_FACILITY':
      return checkRestrictedFacility(supabase, booking)
    default:
      return { passed: true }
  }
}

// --- Individual check implementations ---

async function checkUserRestricted(supabase: SupabaseClient, userId: string): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('users')
    .select('account_status')
    .eq('id', userId)
    .single()
  if (error) return VERIFY_FAILED
  return { passed: data?.account_status !== 'restricted' }
}

export async function checkClassConflict(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('class_schedules')
    .select('id, course_code, section, session_type, day_of_week')
    .eq('facility_id', booking.facility_id)
    .eq('is_active', true)
    .lte('start_time', booking.end_time)
    .gte('end_time', booking.start_time)

  if (error) return VERIFY_FAILED

  // Check if the class recurs on the booking date's day of week.
  // session_type gate: a lecture-only schedule doesn't block a lab booking (and
  // vice-versa). Only filter when both sides name a session_type; null = "any".
  // TZ fix: booking_date is a pure calendar date parsed as UTC midnight — read it
  // with getUTCDay(), not the runtime-local getDay(), for timezone-independent results.
  const bookingDow = new Date(booking.booking_date).getUTCDay()
  const conflicting = (data ?? []).filter((cs: Record<string, unknown>) => {
    const dow = cs.day_of_week as number | null
    if (dow !== bookingDow) return false
    const schedType = cs.session_type as string | null
    if (schedType && booking.session_type && schedType !== booking.session_type) return false
    return true
  })

  if (conflicting.length === 0) return { passed: true }

  // Check for exceptions on this specific date
  const { data: exceptions } = await supabase
    .from('class_schedule_exceptions')
    .select('schedule_id')
    .eq('exception_date', booking.booking_date)
    .in('schedule_id', conflicting.map(c => c.id as string))

  const exceptedIds = new Set(exceptions?.map(e => e.schedule_id) || [])
  const actualConflicts = conflicting.filter(c => !exceptedIds.has(c.id as string))

  if (actualConflicts.length > 0) {
    return {
      passed: false,
      details: { conflicting_class: actualConflicts[0] },
    }
  }
  return { passed: true }
}

async function checkSchoolEventBlock(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('booking_facilities')
    .select('booking_id, bookings!inner(start_time, end_time, event_name, current_status, booking_type)')
    .eq('facility_id', booking.facility_id)
    .eq('bookings.booking_date', booking.booking_date)
    .eq('bookings.booking_type', 'school_event_block')
    .eq('bookings.current_status', 'auto_approved')

  if (error) return VERIFY_FAILED

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conflicts = (data ?? []).filter((row: any) => {
    const b = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
    return b && timesOverlap(b.start_time, b.end_time, booking.start_time, booking.end_time)
  })

  if (conflicts.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = Array.isArray((conflicts[0] as any).bookings) ? (conflicts[0] as any).bookings[0] : (conflicts[0] as any).bookings
    return {
      passed: false,
      details: {
        reason: b.event_name
          ? `Reserved for school event: ${b.event_name}`
          : 'Reserved for a school event',
      },
    }
  }
  return { passed: true }
}

async function checkBookingConflict(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('booking_facilities')
    .select('booking_id, bookings!inner(id, current_status, start_time, end_time, booking_date, created_at)')
    .eq('facility_id', booking.facility_id)
    .eq('bookings.booking_date', booking.booking_date)
    .in('bookings.current_status', ['approved', 'auto_approved', 'flagged', 'pending'])
    .neq('booking_id', booking.booking_id)

  if (error) return VERIFY_FAILED

  // F4 mode-1 tiebreak: a 'pending' conflict only counts if the OTHER booking was
  // created strictly earlier than this one. Without this, two near-simultaneous
  // inserts for the same slot each see the other as an already-existing 'pending'
  // conflict and BOTH auto-decline — nobody wins the slot they raced for. Bookings
  // further along the decision pipeline ('approved'/'auto_approved'/'flagged') are
  // unconditional conflicts regardless of created_at — they already committed past
  // this check, so this booking should lose to them either way.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conflicts = (data ?? []).filter((row: any) => {
    const b = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
    if (!b || !timesOverlap(b.start_time, b.end_time, booking.start_time, booking.end_time)) return false
    if (b.current_status === 'pending') {
      return new Date(b.created_at).getTime() < new Date(booking.created_at).getTime()
    }
    return true
  })

  if (conflicts.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { passed: false, details: { conflicting_booking_id: (conflicts[0] as any).booking_id } }
  }
  return { passed: true }
}

async function checkEquipmentConflict(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  if (!booking.equipment_ids?.length) return { passed: true }

  const { data, error } = await supabase
    .from('booking_equipment')
    .select('equipment_id, bookings!inner(booking_date, start_time, end_time, current_status)')
    .in('equipment_id', booking.equipment_ids)
    .in('bookings.current_status', ['approved', 'auto_approved', 'flagged', 'pending'])
    .neq('booking_id', booking.booking_id)

  if (error) return VERIFY_FAILED

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conflicts = (data ?? []).filter((row: any) => {
    const b = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
    return b && b.booking_date === booking.booking_date &&
      timesOverlap(b.start_time, b.end_time, booking.start_time, booking.end_time)
  })

  if (conflicts.length > 0) {
    return {
      passed: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      details: { conflicting_equipment_id: (conflicts[0] as any).equipment_id },
    }
  }
  return { passed: true }
}

async function checkBufferViolation(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data: facility } = await supabase
    .from('facilities')
    .select('buffer_time')
    .eq('id', booking.facility_id)
    .single()

  if (!facility?.buffer_time) return { passed: true }

  // Parse buffer time interval (e.g., "00:15:00" = 15 minutes)
  const bufferMinutes = parseIntervalToMinutes(facility.buffer_time)
  const bufferedStart = subtractMinutes(booking.start_time, bufferMinutes)
  const bufferedEnd = addMinutes(booking.end_time, bufferMinutes)

  const { data, error } = await supabase
    .from('booking_facilities')
    .select('booking_id, bookings!inner(start_time, end_time, booking_date, current_status)')
    .eq('facility_id', booking.facility_id)
    .eq('bookings.booking_date', booking.booking_date)
    .in('bookings.current_status', ['approved', 'auto_approved', 'flagged'])
    .neq('booking_id', booking.booking_id)

  if (error) return VERIFY_FAILED

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const violations = (data ?? []).filter((row: any) => {
    const b = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
    return b && timesOverlap(b.start_time, b.end_time, bufferedStart, bufferedEnd)
  })

  if (violations.length > 0) {
    return { passed: false, details: { buffer_minutes: bufferMinutes } }
  }
  return { passed: true }
}

export async function checkAdminBlock(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const bookingStartTs = `${booking.booking_date}T${booking.start_time}+08:00`
  const bookingEndTs = `${booking.booking_date}T${booking.end_time}+08:00`

  const { data, error } = await supabase
    .from('facility_blocks')
    .select('id, block_type, reason')
    .eq('facility_id', booking.facility_id)
    .lte('start_time', bookingEndTs)
    .gte('end_time', bookingStartTs)

  if (error) return VERIFY_FAILED

  if ((data ?? []).length > 0) {
    const block = data![0] as Record<string, string>

    let defaultReason = 'Administrative block'
    if (block.block_type === 'maintenance') defaultReason = 'Scheduled maintenance'
    if (block.block_type === 'enrollment') defaultReason = 'Reserved for Enrollment Period'
    if (block.block_type === 'event_hold') defaultReason = 'Held for an upcoming event'

    return {
      passed: false,
      details: {
        block_type: block.block_type,
        reason: block.reason || defaultReason,
      },
    }
  }
  return { passed: true }
}

async function checkOutsideHours(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data: facility } = await supabase
    .from('facilities')
    .select('is_available_for_rental')
    .eq('id', booking.facility_id)
    .single()

  if (facility?.is_available_for_rental === true) return { passed: true }

  const bookingDow = new Date(`${booking.booking_date}T00:00:00`).getDay()
  if (bookingDow === 0) {
    return {
      passed: false,
      details: { reason: 'Sundays are not available for standard internal facility bookings.' },
    }
  }

  // Operating hours: 07:00 - 21:00
  const OPEN = '07:00'
  const CLOSE = '21:00'

  if (booking.start_time < OPEN || booking.end_time > CLOSE) {
    return {
      passed: false,
      details: { operating_hours: `${OPEN} - ${CLOSE}`, requested: `${booking.start_time} - ${booking.end_time}` },
    }
  }
  return { passed: true }
}

async function checkCapacityExceeded(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  if (!booking.expected_attendees) return { passed: true }

  const { data: facility } = await supabase
    .from('facilities')
    .select('capacity, name')
    .eq('id', booking.facility_id)
    .single()

  if (!facility?.capacity) return { passed: true }

  if (booking.expected_attendees > facility.capacity) {
    return {
      passed: false,
      details: { capacity: facility.capacity, requested: booking.expected_attendees },
    }
  }
  return { passed: true }
}

async function checkUnderMaintenance(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data: facility } = await supabase
    .from('facilities')
    .select('status')
    .eq('id', booking.facility_id)
    .single()

  if (facility?.status === 'maintenance') {
    return {
      passed: false,
      details: {
        status: 'maintenance',
        reason: 'This facility is indefinitely set to maintenance status by the administrator.',
      },
    }
  }
  return { passed: true }
}

// FACILITY_CRITICAL_WARNING: block booking when a facility has an active critical-severity warning.
// This is a safety constraint — NOT bypassable by privileged roles.
async function checkCriticalWarning(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data: criticalWarnings } = await supabase
    .from('facility_warnings')
    .select('message')
    .eq('facility_id', booking.facility_id)
    .eq('is_active', true)
    .eq('severity', 'critical')
    .limit(1)

  if (criticalWarnings && criticalWarnings.length > 0) {
    return {
      passed: false,
      details: {
        severity: 'critical',
        reason: `This facility has a critical warning: ${criticalWarnings[0].message}. Please contact the building admin.`,
      },
    }
  }
  return { passed: true }
}

async function checkExamPeriodBlock(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('academic_terms')
    .select('id, name, exam_start_date, exam_end_date')
    .lte('exam_start_date', booking.booking_date)
    .gte('exam_end_date', booking.booking_date)
    .eq('is_active', true)

  if (error) return VERIFY_FAILED

  if ((data ?? []).length > 0) {
    return {
      passed: false,
      details: { period: 'exam', term: (data![0] as Record<string, string>).name },
    }
  }
  return { passed: true }
}

async function checkEnrollmentBlock(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('academic_terms')
    .select('id, name, enrollment_start_date, enrollment_end_date')
    .lte('enrollment_start_date', booking.booking_date)
    .gte('enrollment_end_date', booking.booking_date)
    .eq('is_active', true)

  if (error) return VERIFY_FAILED

  if ((data ?? []).length > 0) {
    return {
      passed: false,
      details: { period: 'enrollment', term: (data![0] as Record<string, string>).name },
    }
  }
  return { passed: true }
}

// Block regular school-use bookings whose date falls outside the active term's [start_date, end_date].
// Skipped for booking_purpose='school_event' (special events flow through their own endpoint and can fall
// outside the term) and for paid/external gym uses (personal/commercial/community) which don't depend on
// academic schedule.
async function checkOutsideAcademicTerm(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const purpose = booking.booking_purpose
  if (purpose === 'school_event' || purpose === 'personal' || purpose === 'commercial' || purpose === 'community') {
    return { passed: true }
  }

  const TERM_KEY = 'booking:active_term_range'
  type TermRange = { term_name: string; start_date: string; end_date: string }

  let term = cacheGet<TermRange | null>(TERM_KEY) ?? null
  if (term === null) {
    const { data, error } = await supabase
      .from('academic_terms')
      .select('term_name, start_date, end_date')
      .eq('is_active', true)
      .maybeSingle()

    if (error) return VERIFY_FAILED
    term = (data as TermRange | null) ?? null
    // Cache the result (even if null) for 24h; flipping the active term busts this via the API.
    cacheSet(TERM_KEY, term ?? { term_name: '', start_date: '', end_date: '' }, TTL_24H)
  }

  // If no active term is configured, do not block — admins can fix the term later.
  if (!term || !term.start_date || !term.end_date) return { passed: true }

  if (booking.booking_date < term.start_date || booking.booking_date > term.end_date) {
    return {
      passed: false,
      details: {
        period: 'outside_term',
        term: term.term_name,
        term_start: term.start_date,
        term_end: term.end_date,
        booking_date: booking.booking_date,
        reason: `Selected date is outside ${term.term_name} (${term.start_date} to ${term.end_date}).`,
      },
    }
  }
  return { passed: true }
}

async function checkAdvanceLimit(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data: facility } = await supabase
    .from('facilities')
    .select('advance_booking_days')
    .eq('id', booking.facility_id)
    .single()

  const maxDays = facility?.advance_booking_days ?? 14
  // Both dates parsed as UTC midnight so the day-difference is always an integer
  const today = new Date(getManilaTodayISO())
  const bookingDate = new Date(booking.booking_date)
  const daysAhead = Math.floor((bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysAhead < 0) {
    return {
      passed: false,
      details: { reason: 'Booking date is in the past', days_ahead: daysAhead },
    }
  }

  if (daysAhead > maxDays) {
    return {
      passed: false,
      details: { max_days: maxDays, days_ahead: daysAhead },
    }
  }
  return { passed: true }
}

// Minimum advance-notice floor set by the building admin (system_settings key
// `min_reservation_lead_days`, Sundays excluded). Paid/rental facilities are
// exempt; privileged roles skip this via PRIVILEGE_BYPASSED.
async function checkMinAdvanceNotice(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data: facility } = await supabase
    .from('facilities')
    .select('is_available_for_rental')
    .eq('id', booking.facility_id)
    .single()
  if (facility?.is_available_for_rental === true) return { passed: true }

  // ponytail: one indexed lookup per booking; cache if a profile ever flags it.
  const { data: setting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', MIN_LEAD_DAYS_KEY)
    .single()
  const minDays = typeof setting?.value === 'number' ? setting.value : DEFAULT_MIN_LEAD_DAYS
  if (minDays <= 0) return { passed: true }

  const earliest = earliestBookableDate(getManilaTodayISO(), minDays)
  if (booking.booking_date < earliest) {
    return {
      passed: false,
      details: {
        min_days: minDays,
        earliest_date: earliest,
        reason: `Reservations must be made at least ${minDays} day(s) in advance (Sundays excluded). Earliest available date is ${earliest}.`,
      },
    }
  }
  return { passed: true }
}

async function checkDurationViolation(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data: facility } = await supabase
    .from('facilities')
    .select('min_booking_duration, max_booking_duration')
    .eq('id', booking.facility_id)
    .single()

  const durationMinutes = timeToMinutes(booking.end_time) - timeToMinutes(booking.start_time)
  const minMinutes = parseIntervalToMinutes(facility?.min_booking_duration ?? '00:30:00')
  const maxMinutes = parseIntervalToMinutes(facility?.max_booking_duration ?? '12:00:00')

  if (durationMinutes < minMinutes || durationMinutes > maxMinutes) {
    return {
      passed: false,
      details: {
        duration_minutes: durationMinutes,
        min_minutes: minMinutes,
        max_minutes: maxMinutes,
      },
    }
  }
  return { passed: true }
}

async function checkPurposeMismatch(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data: facility } = await supabase
    .from('facilities')
    .select('facility_types!inner(name, booking_rules)')
    .eq('id', booking.facility_id)
    .single()

  if (!facility) return { passed: true }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const facilityTypeRaw = (facility as any).facility_types
  const facilityType = Array.isArray(facilityTypeRaw) ? facilityTypeRaw[0] : facilityTypeRaw
  const bookingRules = facilityType?.booking_rules as Record<string, unknown> | null

  // Check if facility type is computer-related and purpose is non-academic
  if (
    facilityType?.name &&
    (facilityType.name as string).toLowerCase().includes('computer') &&
    booking.booking_purpose === 'commercial'
  ) {
    return {
      passed: false,
      details: { facility_type: facilityType.name, purpose: booking.booking_purpose },
    }
  }

  // Check booking_rules JSONB for allowed purposes
  if (bookingRules?.allowed_purposes) {
    const allowed = bookingRules.allowed_purposes as string[]
    if (!allowed.includes(booking.booking_purpose)) {
      return {
        passed: false,
        details: {
          facility_type: facilityType.name,
          purpose: booking.booking_purpose,
          allowed_purposes: allowed,
        },
      }
    }
  }

  return { passed: true }
}

async function checkEventInClassroom(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  if (!['school_event', 'commercial', 'community'].includes(booking.booking_purpose)) {
    return { passed: true }
  }

  const { data: facility } = await supabase
    .from('facilities')
    .select('facility_types!inner(name)')
    .eq('id', booking.facility_id)
    .single()

  if (!facility) return { passed: true }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ftRaw = (facility as any).facility_types
  const ft = Array.isArray(ftRaw) ? ftRaw[0] : ftRaw
  const typeName = (ft?.name ?? '').toLowerCase()
  if (typeName.includes('classroom') || typeName.includes('lecture')) {
    return {
      passed: false,
      details: { facility_type: typeName, purpose: booking.booking_purpose },
    }
  }
  return { passed: true }
}

async function checkRestrictedFacility(supabase: SupabaseClient, booking: BookingContext): Promise<CheckResult> {
  const { data: facility } = await supabase
    .from('facilities')
    .select('always_requires_approval, restricted_notes, name, capacity')
    .eq('id', booking.facility_id)
    .single()

  // Only auditorium has always_requires_approval now (after lab restrictions removed)
  if (facility?.always_requires_approval) {
    // For auditorium: check booking purpose
    // Block commercial/community use, allow academic/school events to go through scoring
    if (['commercial', 'community'].includes(booking.booking_purpose)) {
      return {
        passed: false,
        details: {
          restricted_notes: facility.restricted_notes,
          reason: `${facility.name} requires manual approval for ${booking.booking_purpose} events. Please contact the building admin.`,
        },
      }
    }
    // Academic/school_event/department_use: pass the constraint, let scoring decide
    return { passed: true }
  }

  return { passed: true }
}

// =====================================================
// Time utility helpers
// =====================================================

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return timeToMinutes(start1) < timeToMinutes(end2) &&
    timeToMinutes(end1) > timeToMinutes(start2)
}

function parseIntervalToMinutes(interval: unknown): number {
  // Handle plain numbers (stored as integer minutes in DB)
  if (typeof interval === 'number') return interval
  // Supabase returns INTERVAL columns as objects like {hours: 0, minutes: 15, seconds: 0}
  if (interval && typeof interval === 'object') {
    const obj = interval as Record<string, number>
    return (obj.hours ?? 0) * 60 + (obj.minutes ?? 0)
  }
  const str = String(interval ?? '00:15:00')
  // Handles '00:15:00' or '15 minutes' or '1 hour'
  if (str.includes(':')) {
    const parts = str.split(':').map(Number)
    return parts[0] * 60 + parts[1]
  }
  if (str.includes('hour')) {
    const match = str.match(/(\d+)/)
    return match ? parseInt(match[1]) * 60 : 60
  }
  if (str.includes('minute')) {
    const match = str.match(/(\d+)/)
    return match ? parseInt(match[1]) : 15
  }
  return 15
}

function addMinutes(time: string, minutes: number): string {
  const total = timeToMinutes(time) + minutes
  const h = Math.floor(total / 60).toString().padStart(2, '0')
  const m = (total % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function subtractMinutes(time: string, minutes: number): string {
  const total = Math.max(0, timeToMinutes(time) - minutes)
  const h = Math.floor(total / 60).toString().padStart(2, '0')
  const m = (total % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}
