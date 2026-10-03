/**
 * Course Module Barrel Export
 * @module backend/course
 */

export { validateCourse, parseTemplateRow, validateBatch } from './courseValidation.service'
export { createCourse, createCourseBatch, getCoursesByDepartment, getActiveCoursesByTerm, getCourseByCodeAndDept, updateCourse, getCoursesForFacultyBooking } from './course.service'
export { createUploadBatch, parseCSVContent, parseExcelContent, validateAndPreviewBatch, commitBatch, commitBatchAll, submitBatch, getUploadHistory, generateExcelTemplate, deleteUploadBatch, clearUploadHistory } from './courseUpload.service'
export { getCourseAuditLogs, COURSE_LOG_ACTIONS } from './courseAudit.service'
export type { CourseAuditLog } from './courseAudit.service'
export { getPendingBatches, getBatchDetails, approveBatch, selfApproveBatch, rejectBatchRows, rejectBatch, sendBackBatch, rollbackBatch, onCourseApproved } from './courseApproval.service'
