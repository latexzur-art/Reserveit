/**
 * Booking Pipeline Types
 * @module backend/booking/booking.types
 */

// =====================================================
// Enum mirror types (match DB enums)
// =====================================================

export type CancellationType =
  | 'user_cancelled'
  | 'admin_cancelled'
  | 'facility_unavailable'
  | 'schedule_conflict'
  | 'payment_timeout'
  | 'force_majeure'
  | 'alternative_declined'

export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'auto_approved'
  | 'auto_declined'
  | 'flagged'
  | 'overridden'
  | 'pending_faculty_response'
  | 'pending_user_response'
  | 'on_hold'
  | 'cancellation_requested'
  | 'awaiting_reschedule'

export type OverrideAction = 'cancel' | 'reschedule' | 'change_facility' | 'emergency_reschedule'

export type FacilityTier = 'standard' | 'premium' | 'specialized'

export type BookingPurpose =
  | 'academic'
  | 'school_event'
  | 'department_use'
  | 'personal'
  | 'commercial'
  | 'community'

// =====================================================
// Pipeline constants
// =====================================================

export const SCORING_THRESHOLDS = {
  AUTO_APPROVE: 80,
  FLAG_MIN: 35,
  AUTO_DECLINE_BELOW: 35,
} as const

export const OVERSIGHT_WINDOW_HOURS = 48
export const RESTRICTION_THRESHOLD = 3
export const BASE_SCORE = 80

// =====================================================
// Input types
// =====================================================

export interface CreateBookingInput {
  facility_id: string
  booking_date: string        // 'YYYY-MM-DD'
  start_time: string          // 'HH:MM'
  end_time: string            // 'HH:MM'
  time_slot_id?: string
  purpose: string
  booking_purpose: BookingPurpose
  event_name?: string
  expected_attendees?: number
  special_requests?: string
  equipment_ids?: string[]
  self_facilitation_confirmed?: boolean
  facilitator_name?: string
  facility_purpose_category?: string
  mismatch_justification?: string
  booking_course_code?: string  // NEW: Optional course code (e.g., 'BSIT', 'BSHM')
  booking_department_code?: string  // NEW: Department code for course context
  session_type?: 'lecture' | 'lab' | null  // NEW: Session type for delivery_mode=both courses
}

// Context object passed through the pipeline
export interface BookingContext extends Omit<CreateBookingInput, 'facility_purpose_category' | 'mismatch_justification' | 'booking_course_code' | 'booking_department_code' | 'session_type'> {
  booking_id: string
  user_id: string
  user_type: 'internal' | 'external'
  user_roles: string[]
  account_status: string
  // Department info for smart facility matching
  user_department_id: string | null
  user_department_code: string | null  // 'BSIT', 'BSCS', 'BSBA', etc.
  // Mismatch detection fields (nullable when read from DB)
  facility_purpose_category?: string | null
  mismatch_justification?: string | null
  booking_course_code?: string | null  // NEW: Course code for booking
  booking_department_code?: string | null  // NEW: Department code for course context
  session_type?: 'lecture' | 'lab' | null  // NEW: Session type for delivery_mode=both
  // F4 mode-1: this booking's insert timestamp, used by checkBookingConflict to break
  // ties between two near-simultaneous bookings for the same slot deterministically
  // (earlier-created always wins) instead of both symmetrically seeing each other as
  // a conflict and both auto-declining.
  created_at: string
}

// =====================================================
// Pipeline result types
// =====================================================

export type HardConstraintType =
  | 'USER_RESTRICTED'
  | 'CLASS_CONFLICT'
  | 'BOOKING_CONFLICT'
  | 'EQUIPMENT_CONFLICT'
  | 'BUFFER_VIOLATION'
  | 'ADMIN_BLOCK'
  | 'OUTSIDE_HOURS'
  | 'CAPACITY_EXCEEDED'
  | 'UNDER_MAINTENANCE'
  | 'FACILITY_CRITICAL_WARNING'
  | 'EXAM_PERIOD_BLOCK'
  | 'ENROLLMENT_BLOCK'
  | 'OUTSIDE_ACADEMIC_TERM'
  | 'ADVANCE_LIMIT'
  | 'MIN_ADVANCE_NOTICE'
  | 'DURATION_VIOLATION'
  | 'PURPOSE_MISMATCH'
  | 'EVENT_IN_CLASSROOM'
  | 'RESTRICTED_FACILITY'

export interface HardConstraintResult {
  passed: boolean
  failed_code?: string
  is_reroutable?: boolean
  message?: string
  details?: Record<string, unknown>
  all_results: { code: string; passed: boolean }[]
}

export interface ScoreAdjustment {
  code: string
  name: string
  points: number
  reason: string
}

export interface ScoringResult {
  base_score: number
  adjustments: ScoreAdjustment[]
  final_score: number
}

export interface PipelineResult {
  status: BookingStatus | 'routed_to_manual' | 'hard_constraint_failed'
  booking_id?: string
  booking_reference?: string
  score?: number
  oversight_expires_at?: string
  failed_code?: string
  is_reroutable?: boolean
  message?: string
  suggestions?: AlternativeSuggestion[]
  reason?: string
  decision_id?: string
}

// =====================================================
// Suggestion engine types
// =====================================================

export interface AlternativeSuggestion {
  type: 'room' | 'time_slot' | 'date'
  facility_id?: string
  facility_name?: string
  facility_code?: string
  room_number?: string
  capacity?: number
  floor_number?: number
  building_name?: string
  date?: string
  start_time?: string
  end_time?: string
  reason?: string
}

// =====================================================
// Override handler types
// =====================================================

export interface OverrideInput {
  bookingId: string
  adminUserId: string
  action: OverrideAction
  reason: string
  newValues?: {
    facility_id?: string
    booking_date?: string
    start_time?: string
    end_time?: string
  }
}

// =====================================================
// Availability types
// =====================================================

export interface TimeSlotAvailability {
  slot_id: string
  label: string
  start_time: string
  end_time: string
  is_available: boolean
  conflict_reason?: string
  conflict_type?: 'class' | 'booking' | 'maintenance' | 'admin_block' | 'outside_hours'
}

export interface AvailabilityResponse {
  facility_id: string
  facility_name: string
  date: string
  operating_hours: { open: string; close: string }
  blocked_ranges: {
    start: string
    end: string
    reason: string
    type: string
  }[]
  available_slots: TimeSlotAvailability[]
}

export interface ConflictCheckResult {
  available: boolean
  conflicts: string[]
  conflict_details?: {
    type: string
    start: string
    end: string
    reason: string
  }[]
}

// =====================================================
// Scoring context (internal to softScoringEngine)
// =====================================================

export interface ScoringContext {
  user_type: string
  user_roles: string[]
  booking_count: number
  cancellation_rate: number
  violation_count: number
  has_unpaid_balance: boolean
  booking_purpose: string
  booking_day_of_week: number   // 0=Sunday, 6=Saturday
  start_time_hour: number
  booking_duration_hours: number
  days_until_booking: number
  facility_id: string  // NEW: Needed for course-facility affinity check
  facility_tier: string
  facility_type_name: string
  equipment_count: number
  is_exam_period: boolean
  is_enrollment_period: boolean
  is_semester_break: boolean
  // Department matching
  user_department_code: string | null
  user_department_id: string | null
  booking_course_code: string | null  // NEW: Course code for booking
  booking_department_code: string | null  // NEW: Department code for course context
  session_type: 'lecture' | 'lab' | null  // NEW: Session type
  course_delivery_mode: 'lecture' | 'lab' | 'both' | null  // NEW: From courses table
  session_facility_match: 'lab_in_lecture' | 'lecture_in_lab' | 'correct_match' | null  // NEW: Computed match
}
