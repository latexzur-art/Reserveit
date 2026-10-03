/**
 * Booking Backend — Public API
 * @module backend/booking
 */

export { processBooking } from './bookingPipeline'
export { checkHardConstraints } from './hardConstraintChecker'
export { calculateScore } from './softScoringEngine'
export { checkUserRestriction } from './restrictionChecker'
export type { RestrictionCheckResult } from './restrictionChecker'
export { makeDecision, sendNotification, sendNotificationToRoles } from './autoDecisionRouter'
export type { DecisionResult } from './autoDecisionRouter'
export { handleCancellation, handleCompletion, handleBulkCancellation } from './cancellationHandler'
export type { CancellationResult, BulkCancellationResult } from './cancellationHandler'
export { handleOverride } from './overrideHandler'
export type { OverrideResult } from './overrideHandler'
export { getFacilityAvailability, checkTimeSlotAvailability } from './availabilityService'
export { getSuggestions } from './suggestionEngine'

export type {
  BookingContext,
  BookingStatus,
  BookingPurpose,
  CancellationType,
  OverrideAction,
  FacilityTier,
  CreateBookingInput,
  HardConstraintResult,
  ScoringResult,
  ScoreAdjustment,
  PipelineResult,
  AlternativeSuggestion,
  OverrideInput,
  TimeSlotAvailability,
  AvailabilityResponse,
  ConflictCheckResult,
  ScoringContext,
} from './booking.types'

export { SCORING_THRESHOLDS, OVERSIGHT_WINDOW_HOURS, RESTRICTION_THRESHOLD, BASE_SCORE } from './booking.types'
