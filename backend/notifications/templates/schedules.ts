import { wrapEmailLayout, row, tableWrap, actionButton } from './shared'

export type ScheduleDecisionOutcome = 'published' | 'partially_published' | 'rejected' | 'rolled_back'

const SCHEDULE_OUTCOME_META: Record<ScheduleDecisionOutcome, { label: string; color: string; bg: string; icon: string }> = {
  published: { label: 'PUBLISHED', color: '#155724', bg: '#d4edda', icon: 'check' },
  partially_published: { label: 'PARTIALLY PUBLISHED', color: '#856404', bg: '#fff3cd', icon: '◐' },
  rejected: { label: 'REJECTED', color: '#721c24', bg: '#f8d7da', icon: 'x' },
  rolled_back: { label: 'ROLLED BACK', color: '#856404', bg: '#fff3cd', icon: '↺' },
}

export function schedulePublishedEmail(data: {
  userName: string
  entriesPublished: number
  reservationsCancelled: number
  uploadStatus: 'approved' | 'partially_approved'
  reviewedByName: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const isPartial = data.uploadStatus === 'partially_approved'
  const statusLabel = isPartial ? 'Partially Published' : 'Published'
  const statusColor = isPartial ? '#856404' : '#155724'

  const cancelNote = data.reservationsCancelled > 0
    ? row('Reservations Cancelled',
        `<span style="color:#721c24;">${data.reservationsCancelled} conflicting booking${data.reservationsCancelled === 1 ? '' : 's'} were automatically cancelled.</span>`)
    : ''

  const partialNote = isPartial
    ? `<p style="color:#856404;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px;margin:16px 0;font-size:0.9em;">
        Some entries could not be published due to live schedule conflicts. Please revisit your schedule upload to resolve the remaining entries.
       </p>`
    : ''

  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName + (data.userRole ? ' (' + data.userRole + ')' : '')}</strong>, your schedule upload has been reviewed and entries have been published to the live class schedule.
    </p>
    ${tableWrap(
      row('Status', `<span style="color:${statusColor};font-weight:bold;">${statusLabel.toUpperCase()}</span>`) +
      row('Entries Published', `<strong>${data.entriesPublished}</strong>`) +
      cancelNote +
      row('Reviewed By', data.reviewedByName)
    )}
    ${partialNote}
    ${actionButton(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/program/schedules`, 'View Schedule Upload')}`

  return {
    subject: `Schedule ${statusLabel} — ReserveIT`,
    htmlBody: wrapEmailLayout(`Schedule ${statusLabel}`, body),
  }
}

// ── Schedule Email: Schedule Entries Superseded ──────────────────────────────

export function scheduleSupersededEmail(data: {
  uploaderName: string
  supersededByName: string
  supersededAt: string
  entries: Array<{
    courseCode: string
    section: string
    dayTime: string
    facility: string
  }>
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const count = data.entries.length
  const entryRows = data.entries
    .map(
      (e) => `
        <tr>
          <td style="border:1px solid #dde;padding:10px 14px;color:#333;"><strong>${e.courseCode}</strong>${e.section ? ` — ${e.section}` : ''}</td>
          <td style="border:1px solid #dde;padding:10px 14px;color:#333;">${e.dayTime}</td>
          <td style="border:1px solid #dde;padding:10px 14px;color:#333;">${e.facility}</td>
        </tr>`
    )
    .join('')

  const entriesTable = `
    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="background:#f8f8f8;">
          <th style="border:1px solid #dde;padding:10px 14px;text-align:left;color:#003087;width:35%;">Course</th>
          <th style="border:1px solid #dde;padding:10px 14px;text-align:left;color:#003087;width:35%;">Day &amp; Time</th>
          <th style="border:1px solid #dde;padding:10px 14px;text-align:left;color:#003087;width:30%;">Facility</th>
        </tr>
      </thead>
      <tbody>${entryRows}</tbody>
    </table>`

  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.uploaderName}</strong>, this is a heads-up that <strong>${count}</strong> of your previously published class schedule entr${count === 1 ? 'y was' : 'ies were'} <strong style="color:#856404;">superseded</strong> by a new institution-wide publish from <strong>${data.supersededByName}</strong>.
    </p>
    <p style="color:#856404;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px;margin:16px 0;font-size:0.9em;">
      The affected entries have been deactivated on the live class schedule. They are preserved in history but will no longer appear on the calendar. Any classes occupying the same facility &amp; time slot have been replaced by the newly published schedule.
    </p>
    ${tableWrap(
      row('Status', `<span style="color:#856404;font-weight:bold;">SUPERSEDED</span>`) +
      row('Superseded By', data.supersededByName) +
      row('Superseded At', data.supersededAt) +
      row('Affected Entries', `<strong>${count}</strong>`)
    )}
    <h3 style="margin:24px 0 8px;color:#003087;font-size:15px;">Affected Schedule Entries</h3>
    ${entriesTable}
    <p style="color:#555;line-height:1.6;margin-top:8px;">
      Please review the new live calendar. If a superseded entry was still needed, please coordinate with the Academic Head before re-publishing.
    </p>
    ${actionButton(data.dashboardUrl, 'View Affected Upload')}`

  return {
    subject: `Schedule Entries Superseded — ${count} entr${count === 1 ? 'y' : 'ies'} affected`,
    htmlBody: wrapEmailLayout('Schedule Entries Superseded', body),
  }
}

// ── Booker: Paid Booking Submitted — Proceed to Payment ──────────────────────

export function scheduleSubmittedEmail(data: {
  ahName: string
  submitterName: string
  departmentName: string
  totalEntries: number
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.ahName}</strong>, a new class schedule upload has been submitted and is awaiting your review.
    </p>
    ${tableWrap(
      row('Submitted By', data.submitterName) +
      row('Department', data.departmentName) +
      row('Total Entries', `<strong>${data.totalEntries}</strong>`) +
      row('Status', '<span style="color:#856404;font-weight:bold;">PENDING REVIEW</span>')
    )}
    <p style="color:#555;line-height:1.6;margin-top:16px;">
      Please review the schedule in the portal to approve or send it back for revision.
    </p>
    ${actionButton(data.dashboardUrl, 'Review Schedule')}`

  return {
    subject: `New Schedule Upload Awaiting Review — ${data.departmentName}`,
    htmlBody: wrapEmailLayout('New Schedule Upload', body),
  }
}

export function scheduleReturnedEmail(data: {
  userName: string
  revisionNotes: string
  reviewedByName: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName + (data.userRole ? ' (' + data.userRole + ')' : '')}</strong>, your schedule upload has been returned for revision. Please review the notes below and resubmit once the changes are made.
    </p>
    ${tableWrap(
      row('Status', '<span style="color:#856404;font-weight:bold;">RETURNED FOR REVISION</span>') +
      row('Returned By', data.reviewedByName) +
      row('Revision Notes', `<span style="color:#333;">${data.revisionNotes}</span>`)
    )}
    <p style="color:#555;line-height:1.6;margin-top:16px;">
      Please address the notes above and resubmit your schedule upload for review.
    </p>
    ${actionButton(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/program/schedules`, 'Go to Schedule Upload')}`

  return {
    subject: 'Schedule Returned for Revision — ReserveIT',
    htmlBody: wrapEmailLayout('Schedule Returned for Revision', body),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Emergency Reschedule Templates
// ═══════════════════════════════════════════════════════════════════════════════

// ── Emergency 1: Proposal sent to user ────────────────────────────────────────

export function scheduleBatchDecisionEmail(data: {
  submitterName: string
  departmentName: string
  termName: string
  outcome: ScheduleDecisionOutcome
  approvedCount: number
  rejectedCount: number
  cancelledBookingCount?: number
  supersededCount?: number
  approvedSample?: { courseCode: string; section: string; dayTime: string }[]
  rejectedSample?: { courseCode: string; section: string; reason: string }[]
  decisionNotes?: string | null
  reviewedByName: string
  reviewedAt: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const meta = SCHEDULE_OUTCOME_META[data.outcome]

  const statsRows: string[] = [
    row('Department', data.departmentName),
    row('Term', data.termName),
    row('Status', `<span style="color:${meta.color};font-weight:bold;background:${meta.bg};padding:2px 8px;border-radius:4px;">${meta.icon} ${meta.label}</span>`),
  ]
  if (data.approvedCount > 0) statsRows.push(row('Entries Published', `<strong style="color:#155724;">${data.approvedCount}</strong>`))
  if (data.rejectedCount > 0) statsRows.push(row('Entries Rejected', `<strong style="color:#721c24;">${data.rejectedCount}</strong>`))
  if ((data.cancelledBookingCount ?? 0) > 0) {
    statsRows.push(row('Reservations Cancelled', `<span style="color:#721c24;">${data.cancelledBookingCount} conflicting booking${data.cancelledBookingCount === 1 ? '' : 's'} were automatically cancelled.</span>`))
  }
  if ((data.supersededCount ?? 0) > 0) {
    statsRows.push(row('Schedules Superseded', `<span style="color:#856404;">${data.supersededCount} prior schedule${data.supersededCount === 1 ? '' : 's'} were superseded by this publish.</span>`))
  }
  statsRows.push(row('Reviewed By', data.reviewedByName))
  statsRows.push(row('Reviewed At', data.reviewedAt))
  if (data.decisionNotes) statsRows.push(row('Notes', data.decisionNotes, true))

  const approvedTable = (data.approvedSample && data.approvedSample.length > 0)
    ? `
      <h3 style="margin:24px 0 8px;color:#003087;font-size:14px;">Published Entries (sample)</h3>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px;">
        <thead><tr style="background:#f8f8f8;">
          <th style="border:1px solid #dde;padding:8px 12px;text-align:left;color:#003087;font-size:12px;">Course</th>
          <th style="border:1px solid #dde;padding:8px 12px;text-align:left;color:#003087;font-size:12px;">Day &amp; Time</th>
        </tr></thead>
        <tbody>${data.approvedSample.map(s => `
          <tr>
            <td style="border:1px solid #dde;padding:8px 12px;color:#333;font-size:12px;"><strong>${s.courseCode}</strong>${s.section ? ` — ${s.section}` : ''}</td>
            <td style="border:1px solid #dde;padding:8px 12px;color:#333;font-size:12px;">${s.dayTime}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : ''

  const rejectedTable = (data.rejectedSample && data.rejectedSample.length > 0)
    ? `
      <h3 style="margin:24px 0 8px;color:#721c24;font-size:14px;">Rejected Entries (sample)</h3>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:8px 0 16px;">
        <thead><tr style="background:#fff3cd;">
          <th style="border:1px solid #f5c6cb;padding:8px 12px;text-align:left;color:#721c24;font-size:12px;">Course</th>
          <th style="border:1px solid #f5c6cb;padding:8px 12px;text-align:left;color:#721c24;font-size:12px;">Reason</th>
        </tr></thead>
        <tbody>${data.rejectedSample.map(s => `
          <tr>
            <td style="border:1px solid #f5c6cb;padding:8px 12px;color:#333;font-size:12px;"><strong>${s.courseCode}</strong>${s.section ? ` — ${s.section}` : ''}</td>
            <td style="border:1px solid #f5c6cb;padding:8px 12px;color:#721c24;font-size:12px;">${s.reason}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : ''

  const intro =
    data.outcome === 'published'
      ? 'has been published to the live class schedule.'
      : data.outcome === 'partially_published'
        ? 'has been partially published — some entries went live, others did not.'
        : data.outcome === 'rejected'
          ? 'was rejected and no entries went live.'
          : 'was rolled back. Previously published entries have been retracted.'

  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.submitterName}</strong>, your schedule upload for <strong>${data.departmentName} — ${data.termName}</strong> ${intro}
    </p>
    ${tableWrap(statsRows.join(''))}
    ${approvedTable}
    ${rejectedTable}
    ${actionButton(data.dashboardUrl, 'View Schedule Upload')}`

  return {
    subject: `${SCHEDULE_OUTCOME_META[data.outcome].label} — ${data.departmentName} schedule upload`,
    htmlBody: wrapEmailLayout(SCHEDULE_OUTCOME_META[data.outcome].label.replace(/_/g, ' '), body),
  }
}

// ── Score Reset: Bulk Digest (Academic Head action) ──────────────────────────

// ── Schedule Change Request: Notify AH when PH submits ───────────────────────

export function scheduleChangeRequestSubmittedEmail(data: {
  ahName: string
  phName: string
  changeType: 'modify' | 'cancel' | 'add'
  courseCode?: string | null
  section?: string | null
  reason: string
  reviewUrl: string
}): { subject: string; htmlBody: string } {
  const typeLabel = data.changeType === 'modify' ? 'Modify' : data.changeType === 'cancel' ? 'Cancel' : 'Add'
  const courseInfo = data.courseCode
    ? `${data.courseCode}${data.section ? ` — ${data.section}` : ''}`
    : 'New schedule entry'

  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.ahName}</strong>, a schedule change request has been submitted and requires your review.
    </p>
    ${tableWrap(
      row('Submitted By', `<strong>${data.phName}</strong>`) +
      row('Request Type', `<span style="color:#003087;font-weight:bold;">${typeLabel.toUpperCase()}</span>`) +
      row('Schedule', courseInfo) +
      row('Reason', `<span style="color:#333;">${data.reason}</span>`) +
      row('Status', '<span style="color:#856404;font-weight:bold;">PENDING YOUR REVIEW</span>')
    )}
    <p style="color:#555;line-height:1.6;margin-top:8px;">
      Please review this request and either approve or reject it in the ReserveIT portal.
    </p>
    ${actionButton(data.reviewUrl, 'Review Change Request')}`

  return {
    subject: `Schedule Change Request — ${typeLabel} by ${data.phName}`,
    htmlBody: wrapEmailLayout('Schedule Change Request', body),
  }
}

// ── Schedule Change Request: Notify PH on approval ───────────────────────────

export function scheduleChangeApprovedEmail(data: {
  phName: string
  changeType: 'modify' | 'cancel' | 'add'
  courseCode?: string | null
  section?: string | null
  reviewedByName: string
  notes?: string | null
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const typeLabel = data.changeType === 'modify' ? 'Modify' : data.changeType === 'cancel' ? 'Cancel' : 'Add'
  const courseInfo = data.courseCode
    ? `${data.courseCode}${data.section ? ` — ${data.section}` : ''}`
    : 'Schedule entry'

  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.phName}</strong>, your schedule change request has been <strong style="color:#155724;">approved</strong>.
    </p>
    ${tableWrap(
      row('Request Type', `<span style="color:#003087;font-weight:bold;">${typeLabel.toUpperCase()}</span>`) +
      row('Schedule', courseInfo) +
      row('Reviewed By', data.reviewedByName) +
      row('Status', '<span style="color:#22c55e;font-weight:bold;">APPROVED</span>') +
      (data.notes ? row('Notes', `<span style="color:#333;">${data.notes}</span>`) : '')
    )}
    <p style="color:#555;line-height:1.6;margin-top:8px;">
      The approved change has been applied to the live class schedule.
    </p>
    ${actionButton(data.dashboardUrl, 'View Approved Schedules')}`

  return {
    subject: `Schedule Change Approved — ${typeLabel} request`,
    htmlBody: wrapEmailLayout('Schedule Change Approved', body),
  }
}

// ── Schedule Change Request: Notify PH on rejection ──────────────────────────

export function scheduleChangeRejectedEmail(data: {
  phName: string
  changeType: 'modify' | 'cancel' | 'add'
  courseCode?: string | null
  section?: string | null
  reviewedByName: string
  rejectionReason: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const typeLabel = data.changeType === 'modify' ? 'Modify' : data.changeType === 'cancel' ? 'Cancel' : 'Add'
  const courseInfo = data.courseCode
    ? `${data.courseCode}${data.section ? ` — ${data.section}` : ''}`
    : 'Schedule entry'

  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.phName}</strong>, your schedule change request has been <strong style="color:#721c24;">rejected</strong>.
    </p>
    ${tableWrap(
      row('Request Type', `<span style="color:#003087;font-weight:bold;">${typeLabel.toUpperCase()}</span>`) +
      row('Schedule', courseInfo) +
      row('Reviewed By', data.reviewedByName) +
      row('Status', '<span style="color:#ef4444;font-weight:bold;">REJECTED</span>') +
      row('Reason', `<span style="color:#721c24;">${data.rejectionReason}</span>`)
    )}
    <p style="color:#555;line-height:1.6;margin-top:8px;">
      If you believe this decision was made in error, please contact your Academic Head for clarification.
    </p>
    ${actionButton(data.dashboardUrl, 'View My Schedule Requests')}`

  return {
    subject: `Schedule Change Rejected — ${typeLabel} request`,
    htmlBody: wrapEmailLayout('Schedule Change Rejected', body),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Professor Assignment & Reassignment Templates
// ═══════════════════════════════════════════════════════════════════════════════

export function professorAssignedEmail(data: {
  profName: string
  courseCode: string
  courseName?: string
  section: string
  dayTime: string
  facility?: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.profName}</strong>, you have been assigned to teach the following class section for the academic schedule.
    </p>
    ${tableWrap(
      row('Course Code', `<strong>${data.courseCode}</strong>`) +
      (data.courseName ? row('Course Name', data.courseName) : '') +
      row('Section', data.section) +
      row('Schedule Slot', `<strong>${data.dayTime}</strong>`) +
      (data.facility ? row('Room / Facility', data.facility) : '') +
      row('Status', '<span style="color:#155724;font-weight:bold;">ASSIGNED</span>')
    )}
    <p style="color:#555;line-height:1.6;margin-top:16px;">
      You can review your full teaching schedule and commitments in ReserveIT.
    </p>
    ${actionButton(data.dashboardUrl, 'View My Schedule')}`

  return {
    subject: `Teaching Assignment: ${data.courseCode} (${data.section}) — ReserveIT`,
    htmlBody: wrapEmailLayout('New Class Section Assignment', body),
  }
}

export function professorUnassignedEmail(data: {
  profName: string
  courseCode: string
  section: string
  dayTime: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.profName}</strong>, this is an automated update regarding your teaching commitments. You have been unassigned from the following class section.
    </p>
    ${tableWrap(
      row('Course Code', `<strong>${data.courseCode}</strong>`) +
      row('Section', data.section) +
      row('Previous Slot', data.dayTime) +
      row('Status', '<span style="color:#856404;font-weight:bold;">UNASSIGNED</span>')
    )}
    <p style="color:#555;line-height:1.6;margin-top:16px;">
      Check ReserveIT for your updated weekly schedule and teaching commitments.
    </p>
    ${actionButton(data.dashboardUrl, 'View My Schedule')}`

  return {
    subject: `Schedule Update: Unassigned from ${data.courseCode} (${data.section})`,
    htmlBody: wrapEmailLayout('Teaching Commitment Update', body),
  }
}
