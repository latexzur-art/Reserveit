/**
 * Type definitions for the class schedule upload pipeline.
 * @module backend/schedule/schedule.types
 */

export type ValidationStatus = 'pending' | 'valid' | 'warning' | 'error'
export type AcademicHeadReviewStatus = 'pending_review' | 'academic_head_approved' | 'academic_head_flagged' | 'academic_head_rejected'
export type UploadStatus =
  | 'draft'
  | 'parsing'
  | 'parsed'
  | 'validating'
  | 'validated'
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'partially_approved'
  | 'rejected'
  | 'cancelled'

/** A single row parsed from a CSV file before validation */
export interface RawCsvRow {
  row_number: number
  course_code?: string
  course_name?: string
  section?: string
  facility_name?: string
  instructor_name?: string
  units_raw?: string
  session_type_raw?: string
  day_of_week_raw?: string
  start_time_raw?: string
  end_time_raw?: string
  effective_start_date_raw?: string
  effective_end_date_raw?: string
}

/** A parsed and partially validated staging entry */
export interface ParsedEntry {
  row_number: number
  course_code: string
  course_name: string
  section: string
  facility_name_raw: string
  facility_id: string | null
  facility_match_confidence: number
  instructor_name: string
  instructor_id: string | null
  day_of_week: number
  start_time: string   // HH:MM:SS
  end_time: string     // HH:MM:SS
  effective_start_date: string | null
  effective_end_date: string | null
  session_type: string | null
  validation_status: ValidationStatus
  validation_errors: ValidationError[]
  validation_warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  code: string
  message: string
}

export interface ValidationWarning {
  field: string
  code: string
  message: string
}

export interface ConflictInfo {
  entry_id: string
  conflict_type: 'internal' | 'external' | 'cross_department'
  conflicting_entry_id?: string
  conflicting_schedule_id?: string
  facility_id?: string | null
  instructor_id?: string | null
  day_of_week: number
  start_time: string
  end_time: string
  name?: string
  course_code?: string
  section?: string
}

export interface ParseResult {
  upload_id: string
  total: number
  entries: ParsedEntry[]
  parse_errors: string[]
}

export interface ValidationSummary {
  total: number
  valid: number
  warnings: number
  errors: number
  conflict_count: number
}

export interface PromotionResult {
  promoted_count: number
  skipped_count: number
  errors: string[]
}

/**
 * Exception record for a specific date when a recurring class is voided
 * (e.g., due to a school event)
 */
export interface ClassScheduleException {
  id: string
  schedule_id: string
  exception_date: string // YYYY-MM-DD format
  reason: string | null
  created_by: string | null
  created_at: string
}
