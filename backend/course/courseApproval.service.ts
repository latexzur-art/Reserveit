/**
 * Course Approval Service — stable barrel.
 * Implementation split into queries / decisions / activation
 * (deferred-splits cleanup).
 * @module backend/course/courseApproval.service
 */

export { getPendingBatches, getBatchDetails } from './courseApproval.queries'
export {
  approveBatch,
  selfApproveBatch,
  rejectBatchRows,
  rejectBatch,
  sendBackBatch,
  rollbackBatch,
} from './courseApproval.decisions'
export { onCourseApproved } from './courseActivation'
