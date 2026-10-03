/**
 * Course & Curriculum Management Types
 * @module types/course.types
 */

// =====================================================
// Core course types
// =====================================================

export type DeliveryMode = 'lecture' | 'lab' | 'both' | 'practicum'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'sent_back'
export type UploadMode = 'file_upload' | 'manual_entry' | 'grid_entry'
export type UploadStatus =
  | 'draft'
  | 'parsing'
  | 'parsed'
  | 'validation_failed'
  | 'pending_submission'
  | 'submitted'
  | 'approved'
  | 'partially_rejected'
  | 'rejected'
  | 'deleted'

export type ActivationMethod = 'auto' | 'manual_override'
export type SessionType = 'lecture' | 'lab'

// =====================================================
// Database row types
// =====================================================

export interface Course {
  id: string
  department_code: string
  course_code: string
  course_name: string
  units: number
  year_level: number
  term: number
  delivery_mode: DeliveryMode
  lecture_hours: number | null
  lab_hours: number | null
  prerequisite_codes: string[] | null
  is_elective: boolean
  elective_type: string | null
  description: string | null
  approval_status: ApprovalStatus
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  batch_upload_id: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CourseUploadBatch {
  id: string
  department_id: string | null
  academic_term_id: string | null
  upload_mode: UploadMode
  upload_status: UploadStatus
  source_file_name: string | null
  source_file_type: 'csv' | 'xlsx' | 'xls' | null
  source_file_path: string | null
  source_file_size: number | null
  total_entries: number
  approved_count: number
  rejected_count: number
  pending_count: number
  uploaded_by: string
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
}

export interface TermActivation {
  id: string
  course_id: string
  academic_term_id: string
  is_active: boolean
  activation_method: ActivationMethod
  activated_at: string
  deactivated_at: string | null
  deactivated_by: string | null
}

// =====================================================
// Input types
// =====================================================

export interface CourseCreateInput {
  department_code: string
  course_code: string
  course_name: string
  units: number
  year_level: number
  term: number
  delivery_mode: DeliveryMode
  lecture_hours?: number | null
  lab_hours?: number | null
  prerequisite_codes?: string[]
  is_elective?: boolean
  elective_type?: string | null
  is_active?: boolean
  description?: string
}

export interface CourseTemplateRow {
  department_code: string
  course_code: string
  course_name: string
  units: string | number
  year_level: string | number
  term: string | number
  delivery_mode: string
  lecture_hours?: string | number
  lab_hours?: string | number
  prerequisite_codes?: string
  is_elective?: string | boolean
  elective_type?: string
  description?: string
}

export interface CourseApprovalAction {
  action: 'approve' | 'reject' | 'send_back'
  course_ids?: string[]
  reason?: string
  notes?: string
}

// =====================================================
// Response types
// =====================================================

export interface FacultyCourseResponse {
  departments: {
    department_code: string
    department_name: string
    assigned_courses: CourseListItem[]
    other_courses: CourseListItem[]
  }[]
}

export interface CourseListItem {
  id: string
  course_code: string
  course_name: string
  delivery_mode: DeliveryMode
  units: number
  year_level: number
  term: number
  is_elective: boolean
  elective_type: string | null
}

export interface CourseValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface ValidationIssue {
  field: string
  message: string
  row?: number
}

export interface CourseFilters {
  department_code?: string
  year_level?: number
  term?: number
  delivery_mode?: DeliveryMode
  approval_status?: ApprovalStatus
  search?: string
  page?: number
  limit?: number
  batch_upload_id?: string
}

export interface BatchWithCourses extends CourseUploadBatch {
  courses: Course[]
  department_name?: string
  uploader_name?: string
}

