/** Status labels/colors for curriculum upload batches. */

import type { UploadStatus } from '@/types/course.types'

// ── Status display helpers ─────────────────────────────────────
export const STATUS_LABELS: Record<UploadStatus, string> = {
  draft: 'Draft',
  parsing: 'Parsing',
  parsed: 'Parsed',
  validation_failed: 'Validation Failed',
  pending_submission: 'Pending Submission',
  submitted: 'Submitted',
  approved: 'Approved',
  partially_rejected: 'Partially Rejected',
  rejected: 'Rejected',
  deleted: 'Deleted',
}

export const STATUS_COLORS: Record<UploadStatus, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  parsing: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  parsed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  validation_failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pending_submission: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  partially_rejected: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  deleted: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
}

export const COURSE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  sent_back: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
}

export const MODE_LABELS: Record<string, string> = {
  file_upload: 'CSV Upload',
  grid_entry: 'Grid Entry',
  manual_entry: 'Manual',
}

// ── Audit-log action display helpers (academic head Course History › Logs) ──
export const LOG_ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  batch_approved: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  batch_self_published: { label: 'Published', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  batch_rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  batch_rows_rejected: { label: 'Rows Rejected', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  batch_sent_back: { label: 'Sent Back', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  delete_rejected_upload: { label: 'Deleted', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  upload_history_cleared: { label: 'History Cleared', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
}

// ── Per-row component ──────────────────────────────────────────
