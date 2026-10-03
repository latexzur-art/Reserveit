/**
 * Schedule pipeline barrel exports.
 * @module backend/schedule
 */

export { parseCsvText, parseDayOfWeek, parseTime, parseDate } from './csvParser'
export { matchFacility, matchInstructor, clearFacilityCache } from './facilityMatcher'
export { validateAndEnrichEntry } from './entryValidator'
export { detectConflicts, detectAllConflicts } from './conflictDetector'
export { promoteApprovedEntries } from './schedulePromoter'
export { notifyCrossDeptConflicts } from './conflictNotifier'
export type {
  ValidationStatus,
  AcademicHeadReviewStatus,
  UploadStatus,
  RawCsvRow,
  ParsedEntry,
  ValidationError,
  ValidationWarning,
  ConflictInfo,
  ParseResult,
  ValidationSummary,
  PromotionResult,
} from './schedule.types'
