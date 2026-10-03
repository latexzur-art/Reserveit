import { wrapEmailLayout, row, tableWrap, actionButton } from './shared'

export function bookingConfirmationEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  duration: string
  purpose: string
  eventName?: string
  status: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const statusLabel = data.status === 'auto_approved' ? 'Approved' : data.status === 'flagged' ? 'Pending Review' : data.status
  const statusColor = data.status === 'auto_approved' ? '#1a7a3f' : '#856404'

  const body = `
    <p style="color:#555;line-height:1.6;">
      Dear <strong>${data.userName + (data.userRole ? ' (' + data.userRole + ')' : '')}</strong>, your facility booking has been received!
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Duration', data.duration) +
      row('Purpose', data.purpose) +
      (data.eventName ? row('Event / Activity Name', data.eventName) : '') +
      row('Status', `<span style="color:${statusColor};font-weight:bold;">${statusLabel}</span>`)
    )}
    <p style="color:#555;line-height:1.6;margin-top:8px;">
      ${data.status === 'flagged'
        ? 'Your booking is currently <strong>pending admin review</strong>. You will receive another email once it has been approved or rejected.'
        : 'Your booking has been <strong>automatically approved</strong>. You will receive a reminder before your booking starts.'
      }
    </p>`

  return {
    subject: `Booking Confirmation — ${data.facilityName} on ${data.bookingDate}`,
    htmlBody: wrapEmailLayout('Booking Confirmation', body),
  }
}

// ── Email 3: Booking Approval ─────────────────────────────────────────────────

export function bookingApprovalEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  approvedBy: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Dear <strong>${data.userName + (data.userRole ? ' (' + data.userRole + ')' : '')}</strong>, good news! Your booking request has been <strong style="color:#1a7a3f;">approved</strong>.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Approved By', data.approvedBy) +
      row('Status', '<span style="color:#1a7a3f;font-weight:bold;">APPROVED</span>')
    )}
    <p style="color:#555;line-height:1.6;margin-top:8px;">
      Your booking is now confirmed. You will receive a reminder before your booking starts.
    </p>`

  return {
    subject: `Your Booking Has Been Approved — ${data.facilityName}`,
    htmlBody: wrapEmailLayout('Booking Approved', body),
  }
}

// ── Email 4: Booking Rejection ────────────────────────────────────────────────

export function bookingRejectionEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  rejectionReason: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Dear <strong>${data.userName + (data.userRole ? ' (' + data.userRole + ')' : '')}</strong>, your booking request has been reviewed.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Status', '<span style="color:#c0392b;font-weight:bold;">REJECTED</span>') +
      row('Reason', data.rejectionReason, true)
    )}
    <p style="color:#555;line-height:1.6;margin-top:8px;"><strong>Next Steps:</strong></p>
    <ul style="color:#555;line-height:1.8;padding-left:20px;">
      <li>Try booking a different time slot</li>
      <li>Contact the administrator for clarification</li>
      <li>Visit the ReserveIT portal to browse available times</li>
    </ul>`

  return {
    subject: `Booking Request Update — ${data.facilityName}`,
    htmlBody: wrapEmailLayout('Booking Request Rejected', body),
  }
}

// ── Email 5: Booking Cancellation ─────────────────────────────────────────────

export function bookingCancellationEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  cancelledBy: string
  cancelledAt: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Dear <strong>${data.userName + (data.userRole ? ' (' + data.userRole + ')' : '')}</strong>, your facility booking has been <strong style="color:#c0392b;">cancelled</strong>.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Original Date', data.bookingDate) +
      row('Original Time', `${data.startTime} – ${data.endTime}`) +
      row('Cancelled By', data.cancelledBy) +
      row('Cancellation Date', data.cancelledAt)
    )}
    <p style="color:#555;line-height:1.6;margin-top:8px;">
      You can book another time slot through the ReserveIT portal. If you need assistance, contact the administrator.
    </p>`

  return {
    subject: `Booking Cancelled — ${data.facilityName} on ${data.bookingDate}`,
    htmlBody: wrapEmailLayout('Booking Cancelled', body),
  }
}

// ── Email: Booking Change Proposed ───────────────────────────────────────────

export function bookingChangeProposedEmail(data: {
  userName: string
  bookingRef: string
  currentFacility: string
  currentDate: string
  currentStartTime: string
  currentEndTime: string
  proposedFacility?: string
  proposedDate?: string
  proposedStartTime?: string
  proposedEndTime?: string
  proposedBy: string
  reason: string
  reviewUrl: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const currentRows =
    row('Reference #', `<strong>${data.bookingRef}</strong>`) +
    row('Facility', data.currentFacility) +
    row('Date', data.currentDate) +
    row('Time', `${data.currentStartTime} – ${data.currentEndTime}`)

  const proposedRows =
    (data.proposedFacility ? row('New Facility', data.proposedFacility, true) : '') +
    (data.proposedDate ? row('New Date', data.proposedDate, true) : '') +
    ((data.proposedStartTime || data.proposedEndTime)
      ? row(
          'New Time',
          `${data.proposedStartTime ?? data.currentStartTime} – ${data.proposedEndTime ?? data.currentEndTime}`,
          true
        )
      : '')

  const body = `
    <p style="color:#555;line-height:1.6;">
      Dear <strong>${data.userName + (data.userRole ? ' (' + data.userRole + ')' : '')}</strong>,
      the <strong>${data.proposedBy}</strong> has proposed changes to your booking. Please review and accept or decline the proposal.
    </p>
    <h3 style="color:#003087;margin:24px 0 8px;font-size:15px;">Current Booking</h3>
    ${tableWrap(currentRows)}
    <h3 style="color:#856404;margin:24px 0 8px;font-size:15px;">Proposed Changes</h3>
    ${tableWrap(proposedRows + row('Reason', data.reason, true))}
    ${actionButton(data.reviewUrl, 'Review Proposal')}
    <p style="color:#555;line-height:1.6;margin-top:16px;font-size:13px;">
      If you do not respond, your original booking remains pending. Accept to apply the changes, or decline to keep your original slot (subject to admin review).
    </p>`

  return {
    subject: `[ACTION REQUIRED] Booking Change Proposed — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Booking Change Proposed', body),
  }
}

// ── Email: Faculty Response to Proposed Changes ──────────────────────────────

export function proposalResponseEmail(data: {
  proposerName: string
  facultyName: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  action: 'accepted' | 'declined'
  adminPanelUrl: string
  respondedAt: string
}): { subject: string; htmlBody: string } {
  const isAccepted = data.action === 'accepted'
  const statusLabel = isAccepted ? 'ACCEPTED' : 'DECLINED'
  const statusColor = isAccepted ? '#155724' : '#721c24'
  const headline = isAccepted
    ? `<strong>${data.facultyName}</strong> has <strong style="color:#155724;">accepted</strong> your proposed changes. The booking has been updated with the new schedule.`
    : `<strong>${data.facultyName}</strong> has <strong style="color:#721c24;">declined</strong> your proposed changes. The booking has been <strong>cancelled</strong> — the faculty member will need to create a new reservation if they still want the slot.`

  const body = `
    <p style="color:#555;line-height:1.6;">
      Dear <strong>${data.proposerName}</strong>, ${headline}
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Faculty', data.facultyName) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Response', `<span style="color:${statusColor};font-weight:bold;">${statusLabel}</span>`) +
      row('Responded At', data.respondedAt)
    )}
    ${actionButton(data.adminPanelUrl, 'View Booking in Admin Panel')}`

  return {
    subject: `[ReserveIT] Faculty ${isAccepted ? 'Accepted' : 'Declined'} Proposed Changes — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout(`Proposal ${isAccepted ? 'Accepted' : 'Declined'}`, body),
  }
}

// ── Admin: Academic Head Cancelled a Booking ─────────────────────────────────

export function adminAcademicHeadCancelledEmail(data: {
  adminName: string
  facultyName: string
  facultyEmail: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  eventName?: string
  purpose?: string
  bookingPurpose?: string
  cancelledByName: string
  reason: string
  adminPanelUrl: string
  cancelledAt: string
}): { subject: string; htmlBody: string } {
  const subjectLabel = data.eventName || data.bookingPurpose || '—'
  const purposeRow = data.purpose ? row('Purpose / Description', data.purpose) : ''
  const eventRow = subjectLabel !== '—' ? row('Subject / Event', subjectLabel) : ''

  const body = `
    <p style="color:#555;line-height:1.6;">
      Dear <strong>${data.adminName}</strong>,
      the Academic Head <strong>${data.cancelledByName}</strong> has cancelled a faculty booking. Details are below for your records.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Faculty Member', `${data.facultyName} — <span style="color:#555;">${data.facultyEmail}</span>`) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      eventRow +
      purposeRow +
      row('Cancelled By', data.cancelledByName) +
      row('Reason', `<em>${data.reason}</em>`, true) +
      row('Status', '<span style="color:#721c24;font-weight:bold;">CANCELLED</span>') +
      row('Cancelled At', data.cancelledAt)
    )}
    ${actionButton(data.adminPanelUrl, 'View in Admin Panel')}`

  return {
    subject: `[ReserveIT] Booking Cancelled by Academic Head — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Booking Cancelled by Academic Head', body),
  }
}

// ── Admin: Faculty Self-Cancellation Notice ───────────────────────────────────

export function adminFacultyCancelledEmail(data: {
  adminName: string
  facultyName: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  leadTimeHours: number | null
  adminPanelUrl: string
  cancelledAt: string
}): { subject: string; htmlBody: string } {
  const leadNote = data.leadTimeHours !== null
    ? data.leadTimeHours < 1
      ? 'less than 1 hour before the booking'
      : `${data.leadTimeHours.toFixed(1)} hours before the booking`
    : ''
  const isSameDay = data.leadTimeHours !== null && data.leadTimeHours < 12

  const body = `
    <p style="color:#555;line-height:1.6;">
      Dear <strong>${data.adminName}</strong>,
      faculty member <strong>${data.facultyName}</strong> has cancelled their booking${leadNote ? ` — <strong>${leadNote}</strong>` : ''}.
      ${isSameDay ? '<br><span style="color:#856404;font-weight:bold;">This is a same-day cancellation.</span>' : ''}
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Faculty', data.facultyName) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Status', '<span style="color:#721c24;font-weight:bold;">CANCELLED</span>') +
      row('Cancelled At', data.cancelledAt)
    )}
    ${actionButton(data.adminPanelUrl, 'View in Admin Panel')}`

  return {
    subject: `[ReserveIT] Faculty Booking Cancelled — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Faculty Booking Cancelled', body),
  }
}

// ── Email 6: Booking Reminder — 24 Hours Before ───────────────────────────────

export function adminPendingBookingEmail(data: {
  bookingRef: string
  submittedBy: string
  userEmail: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  duration: string
  purpose: string
  eventName?: string
  adminPanelUrl: string
  submittedAt: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      A new booking has been submitted and <strong>requires your approval</strong>.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Submitted By', `${data.submittedBy + (data.userRole ? ' (' + data.userRole + ')' : '')} — ${data.userEmail}`) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Duration', data.duration) +
      row('Purpose', data.purpose) +
      (data.eventName ? row('Event / Activity Name', data.eventName) : '') +
      row('Status', '<span style="color:#856404;font-weight:bold;">PENDING APPROVAL</span>') +
      row('Submitted At', data.submittedAt)
    )}
    ${actionButton(data.adminPanelUrl, 'Review Booking in Admin Panel')}`

  return {
    subject: `[ACTION REQUIRED] New Booking Approval Needed — ${data.facilityName}`,
    htmlBody: wrapEmailLayout('New Booking Pending Approval', body),
  }
}

// ── Admin FYI: Booking Auto-Decided ──────────────────────────────────────────

export function adminBookingNotificationEmail(data: {
  bookingRef: string
  submittedBy: string
  userEmail: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  duration: string
  purpose: string
  eventName?: string
  adminPanelUrl: string
  submittedAt: string
  decision: 'auto_approved' | 'auto_declined'
  reason?: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const isApproved = data.decision === 'auto_approved'
  const statusLabel = isApproved ? 'AUTO-APPROVED' : 'AUTO-DECLINED'
  const statusColor = isApproved ? '#155724' : '#721c24'
  const headline = isApproved
    ? 'A new faculty booking was automatically approved by the system.'
    : 'A new faculty booking was automatically declined by the system.'

  const reasonRow = !isApproved && data.reason ? row('Reason', data.reason, true) : ''

  const body = `
    <p style="color:#555;line-height:1.6;">
      ${headline} This notification is for your awareness — no action is required.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Submitted By', `${data.submittedBy + (data.userRole ? ' (' + data.userRole + ')' : '')} — ${data.userEmail}`) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Duration', data.duration) +
      row('Purpose', data.purpose) +
      (data.eventName ? row('Event / Activity Name', data.eventName) : '') +
      row('Status', `<span style="color:${statusColor};font-weight:bold;">${statusLabel}</span>`) +
      reasonRow +
      row('Submitted At', data.submittedAt)
    )}
    ${actionButton(data.adminPanelUrl, 'View Booking in Admin Panel')}`

  return {
    subject: `[FYI] Booking ${isApproved ? 'Approved' : 'Declined'} — ${data.facilityName}`,
    htmlBody: wrapEmailLayout(`Booking ${isApproved ? 'Approved' : 'Declined'}`, body),
  }
}

// ── Schedule Email 1: Schedule Published ─────────────────────────────────────
