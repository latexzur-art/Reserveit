import { wrapEmailLayout, row, tableWrap, actionButton } from './shared'

export function curriculumUploadPendingEmail(data: {
  uploadId: string
  departmentName: string
  termName: string
  totalEntries: number
  uploadedByName: string
  submittedAt: string
  reviewUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      A new curriculum schedule upload has been submitted and is <strong>awaiting your approval</strong> before it can be activated for the current term.
    </p>
    ${tableWrap(
      row('Department', data.departmentName) +
      row('Term', data.termName) +
      row('Total Course Entries', `${data.totalEntries} courses`) +
      row('Uploaded By', data.uploadedByName) +
      row('Submitted At', data.submittedAt)
    )}
    ${actionButton(data.reviewUrl, 'Go to Approval Queue')}`

  return {
    subject: `[ReserveIT] Curriculum Upload Awaiting Your Approval — ${data.departmentName} (${data.termName})`,
    htmlBody: wrapEmailLayout('Curriculum Upload Pending Approval', body),
  }
}

// ── Template 3: Curriculum Batch Approved ───────────────────────────────────

export function curriculumBatchApprovedEmail(data: {
  submitterName: string
  departmentName: string
  termName: string
  approvedCount: number
  reviewedByName: string
  reviewedAt: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Great news! Your curriculum submission for <strong>${data.departmentName}</strong> has been
      <strong style="color:#1a7a3f;">approved</strong> by the Academic Head and is now active for the term.
    </p>
    ${tableWrap(
      row('Department', data.departmentName) +
      row('Term', data.termName) +
      row('Approved Courses', `<span style="color:#1a7a3f;font-weight:bold;">${data.approvedCount} courses</span>`) +
      row('Reviewed By', data.reviewedByName) +
      row('Reviewed At', data.reviewedAt)
    )}
    ${actionButton(data.dashboardUrl, 'View Submission Status')}`

  return {
    subject: `[ReserveIT] Curriculum Submission Approved — ${data.departmentName} (${data.termName})`,
    htmlBody: wrapEmailLayout('Curriculum Submission Approved', body),
  }
}

// ── Template 4: Curriculum Batch Rejected ───────────────────────────────────

export function curriculumBatchRejectedEmail(data: {
  submitterName: string
  departmentName: string
  termName: string
  rejectedCount: number
  reason: string
  reviewedByName: string
  reviewedAt: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Your curriculum submission for <strong>${data.departmentName}</strong> has been
      <strong style="color:#c0392b;">rejected</strong>. Please review the reason below and contact
      the Academic Head if you have questions.
    </p>
    ${tableWrap(
      row('Department', data.departmentName) +
      row('Term', data.termName) +
      row('Rejected Courses', `<span style="color:#c0392b;font-weight:bold;">${data.rejectedCount} courses</span>`) +
      row('Rejection Reason', data.reason, true) +
      row('Reviewed By', data.reviewedByName) +
      row('Reviewed At', data.reviewedAt)
    )}
    ${actionButton(data.dashboardUrl, 'View Submission Status')}`

  return {
    subject: `[ReserveIT] Curriculum Submission Rejected — ${data.departmentName} (${data.termName})`,
    htmlBody: wrapEmailLayout('Curriculum Submission Rejected', body),
  }
}

// ── Template 5: Curriculum Batch Sent Back ───────────────────────────────────

export function curriculumBatchSentBackEmail(data: {
  submitterName: string
  departmentName: string
  termName: string
  notes: string
  reviewedByName: string
  reviewedAt: string
  revisionsUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Your curriculum submission for <strong>${data.departmentName}</strong> has been
      <strong style="color:#856404;">returned for revisions</strong>. Please address the notes
      below and resubmit.
    </p>
    ${tableWrap(
      row('Department', data.departmentName) +
      row('Term', data.termName) +
      row('Revision Notes', data.notes, true) +
      row('Returned By', data.reviewedByName) +
      row('Returned At', data.reviewedAt)
    )}
    ${actionButton(data.revisionsUrl, 'Open & Revise Submission')}`

  return {
    subject: `[ReserveIT] Curriculum Submission Returned for Revisions — ${data.departmentName} (${data.termName})`,
    htmlBody: wrapEmailLayout('Curriculum Submission Returned for Revisions', body),
  }
}

// ── Template 5c: Curriculum Batch Deleted (by Academic Head) ───────────────

export function curriculumBatchDeletedEmail(data: {
  submitterName: string
  departmentName: string
  totalEntries: number
  deletedByName: string
  deletedAt: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Your curriculum batch for <strong>${data.departmentName}</strong> has been
      <strong style="color:#c0392b;">deleted</strong> by the Academic Head.
    </p>
    ${tableWrap(
      row('Department', data.departmentName) +
      row('Total Course Entries', `${data.totalEntries} courses`) +
      row('Deleted By', data.deletedByName) +
      row('Deleted At', data.deletedAt)
    )}
    ${actionButton(data.dashboardUrl, 'View Upload History')}`

  return {
    subject: `[ReserveIT] Curriculum Batch Deleted — ${data.departmentName}`,
    htmlBody: wrapEmailLayout('Curriculum Batch Deleted', body),
  }
}

// ── Template 5b: Curriculum Batch Deletion Requested ────────────────────────

export function curriculumDeletionRequestedEmail(data: {
  requesterName: string
  departmentName: string
  totalEntries: number
  reason: string
  reviewUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      <strong>${data.requesterName}</strong> has requested deletion of their curriculum batch for
      <strong>${data.departmentName}</strong>. Please review the request below.
    </p>
    ${tableWrap(
      row('Department', data.departmentName) +
      row('Total Course Entries', `${data.totalEntries} courses`) +
      row('Requested By', data.requesterName) +
      row('Reason', data.reason || 'No reason provided', true)
    )}
    ${actionButton(data.reviewUrl, 'View Upload History')}`

  return {
    subject: `[ReserveIT] Batch Deletion Requested — ${data.departmentName}`,
    htmlBody: wrapEmailLayout('Curriculum Batch Deletion Requested', body),
  }
}

// ── Template 6: Maintenance Reminder ────────────────────────────────────────
