import { wrapEmailLayout, row, tableWrap, actionButton } from './shared'

export function mismatchedReservationEmail(data: {
  bookingReference: string
  requesterName: string
  facilityName: string
  bookingDate: string
  sessionType: string
  facilityCategory: string
  mismatchFlag: string
  purpose: string
  score: number
  reviewUrl: string
}): { subject: string; htmlBody: string } {
  const flagLabel =
    data.mismatchFlag === 'SESSION_LECTURE_IN_LAB_MISMATCH'
      ? 'Lecture session booked in a Laboratory room'
      : data.mismatchFlag === 'UNRECOGNIZED_CROSS_DEPT_USE'
        ? 'Unrecognized cross-department facility use'
        : data.mismatchFlag

  const body = `
    <p style="color:#555;line-height:1.6;">
      A booking has been flagged for a <strong>facility-purpose mismatch</strong> and requires your review before it can proceed.
    </p>
    ${tableWrap(
      row('Booking Reference', data.bookingReference) +
      row('Requester', data.requesterName) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Session Type', data.sessionType) +
      row('Purpose', data.purpose) +
      row('Mismatch Reason', flagLabel, true) +
      row('Scoring Score', `${data.score} / 100 (Manual Review Zone)`)
    )}
    ${actionButton(data.reviewUrl, 'Review This Booking')}`

  return {
    subject: `[ReserveIT] Mismatched Booking Requires Your Review — ${data.bookingReference}`,
    htmlBody: wrapEmailLayout('Mismatched Booking — Action Required', body),
  }
}

// ── Template 1b: Faculty Booking Under Mismatch Review ──────────────────────

export function facultyMismatchNotificationEmail(data: {
  bookingReference: string
  facultyName: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  mismatchFlag: string
  statusUrl: string
}): { subject: string; htmlBody: string } {
  const flagLabel =
    data.mismatchFlag === 'SESSION_LECTURE_IN_LAB_MISMATCH'
      ? 'Lecture session in a Laboratory / Specialized room'
      : data.mismatchFlag === 'UNRECOGNIZED_CROSS_DEPT_USE'
        ? 'Cross-department facility use requires verification'
        : 'Facility-purpose mismatch detected'

  const body = `
    <p style="color:#555;line-height:1.6;">
      Hello ${data.facultyName}, your booking has been placed <strong>under Academic Head review</strong> due to a facility-purpose mismatch. No action is required from you at this time — you will be notified once a decision is made.
    </p>
    ${tableWrap(
      row('Booking Reference', data.bookingReference) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Review Reason', flagLabel, true)
    )}
    <p style="color:#555;line-height:1.6;font-size:13px;">
      The Academic Head will either <strong>approve</strong> your booking, <strong>suggest an alternative facility</strong>, or <strong>decline</strong> the request. Check your reservations page for updates.
    </p>
    ${actionButton(data.statusUrl, 'View My Reservations')}`

  return {
    subject: `[ReserveIT] Your Booking (${data.bookingReference}) is Under Review`,
    htmlBody: wrapEmailLayout('Booking Pending Academic Head Review', body),
  }
}

// ── Template 1c: Academic Head — Mismatch Decision Emails ───────────────────
// One function handles approve / decline / suggest_alternative to faculty.

export function mismatchDecisionEmail(data: {
  bookingReference: string
  facultyName: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  action: 'approve' | 'decline' | 'suggest_alternative'
  alternativeFacilityName?: string
  reviewerNotes?: string
  statusUrl: string
  reviewerRole?: 'academic_head' | 'building_admin'
}): { subject: string; htmlBody: string } {
  const isApprove = data.action === 'approve'
  const isDecline = data.action === 'decline'
  const isSuggest = data.action === 'suggest_alternative'
  const reviewerLabel = data.reviewerRole === 'building_admin' ? 'Building Admin' : 'Academic Head'

  const title = isApprove
    ? `Booking Approved by ${reviewerLabel}`
    : isDecline
      ? `Booking Declined by ${reviewerLabel}`
      : 'Alternative Facility Suggested'

  const intro = isApprove
    ? `Great news, ${data.facultyName}! The ${reviewerLabel} has <strong>approved</strong> your booking.`
    : isDecline
      ? `Hello ${data.facultyName}, the ${reviewerLabel} has <strong>declined</strong> your booking after review.`
      : `Hello ${data.facultyName}, the ${reviewerLabel} has reviewed your booking and is suggesting an <strong>alternative facility</strong>.`

  const actionRow = isSuggest && data.alternativeFacilityName
    ? row('Suggested Facility', data.alternativeFacilityName, true)
    : ''

  const notesRow = data.reviewerNotes
    ? row(isDecline ? 'Decline Reason' : 'Notes', data.reviewerNotes, isDecline)
    : ''

  const nextStep = isApprove
    ? 'Your booking has been confirmed. No further action is required.'
    : isDecline
      ? 'You may submit a new booking request for a different facility or time.'
      : 'Please log in to your reservations page to <strong>accept or decline</strong> the suggested facility.'

  const buttonLabel = isSuggest ? 'Respond to Suggestion' : 'View My Reservations'

  const body = `
    <p style="color:#555;line-height:1.6;">${intro}</p>
    ${tableWrap(
      row('Booking Reference', data.bookingReference) +
      row('Original Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      actionRow +
      notesRow
    )}
    <p style="color:#555;line-height:1.6;font-size:13px;">${nextStep}</p>
    ${actionButton(data.statusUrl, buttonLabel)}`

  return {
    subject: `[ReserveIT] ${title} — ${data.bookingReference}`,
    htmlBody: wrapEmailLayout(title, body),
  }
}

// ── Template 1d: Academic Head — Faculty Alternative Response ────────────────
// Sent to the Academic Head when faculty accepts or declines a suggested alternative.

export function facultyAlternativeResponseEmail(data: {
  bookingReference: string
  facultyName: string
  originalFacilityName: string
  alternativeFacilityName: string
  bookingDate: string
  accepted: boolean
  reviewUrl: string
}): { subject: string; htmlBody: string } {
  const action = data.accepted ? 'Accepted' : 'Declined'
  const color = data.accepted ? '#2d6a4f' : '#9b2226'

  const body = `
    <p style="color:#555;line-height:1.6;">
      The faculty member <strong>${data.facultyName}</strong> has <strong style="color:${color};">${action.toLowerCase()}</strong> the alternative facility you suggested for booking <strong>${data.bookingReference}</strong>.
    </p>
    ${tableWrap(
      row('Booking Reference', data.bookingReference) +
      row('Faculty', data.facultyName) +
      row('Original Facility', data.originalFacilityName) +
      row('Suggested Alternative', data.alternativeFacilityName) +
      row('Date', data.bookingDate) +
      row('Faculty Decision', action, true)
    )}
    <p style="color:#555;line-height:1.6;font-size:13px;">
      ${data.accepted
        ? 'The booking has been re-processed with the alternative facility.'
        : 'The booking has been <strong>cancelled</strong> as the faculty declined the alternative.'}
    </p>
    ${actionButton(data.reviewUrl, 'View Review Queue')}`

  return {
    subject: `[ReserveIT] Faculty ${action} Alternative — ${data.bookingReference}`,
    htmlBody: wrapEmailLayout(`Faculty ${action} Alternative Facility`, body),
  }
}

// ── Template 1e: Faculty — Own Alternative Response Confirmation ────────────
// Sent to the faculty themselves to confirm their accept/decline action.

export function facultyAlternativeResponseConfirmationEmail(data: {
  bookingReference: string
  facultyName: string
  originalFacilityName: string
  alternativeFacilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  accepted: boolean
  statusUrl: string
}): { subject: string; htmlBody: string } {
  const title = data.accepted
    ? 'Booking Confirmed — Alternative Facility'
    : 'Booking Cancelled — Alternative Declined'

  const intro = data.accepted
    ? `Hello ${data.facultyName}, you have <strong style="color:#2d6a4f;">accepted</strong> the alternative facility suggested by the Academic Head. Your booking is now <strong>confirmed</strong>.`
    : `Hello ${data.facultyName}, you have <strong style="color:#9b2226;">declined</strong> the alternative facility suggested by the Academic Head. Your booking has been <strong>cancelled</strong>.`

  const nextStep = data.accepted
    ? 'Your reservation is set. No further action is required.'
    : 'You may submit a new booking request for a different facility or time.'

  const body = `
    <p style="color:#555;line-height:1.6;">${intro}</p>
    ${tableWrap(
      row('Booking Reference', data.bookingReference) +
      row('Original Facility', data.originalFacilityName) +
      row('Suggested Alternative', data.alternativeFacilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Your Decision', data.accepted ? 'Accepted' : 'Declined', true)
    )}
    <p style="color:#555;line-height:1.6;font-size:13px;">${nextStep}</p>
    ${actionButton(data.statusUrl, 'View My Reservations')}`

  return {
    subject: `[ReserveIT] ${title} — ${data.bookingReference}`,
    htmlBody: wrapEmailLayout(title, body),
  }
}

// ── Template 1f: Cross-Role Mismatch Review Broadcast ──────────────────────
// Sent to building admins + academic heads (excluding the actor) so the team
// stays in sync on mismatch queue activity.

export function mismatchReviewBroadcastEmail(data: {
  action: 'approve' | 'decline' | 'suggest_alternative'
  bookingReference: string
  actorName: string
  actorRoleLabel: string
  requesterName: string
  originalFacilityName: string
  alternativeFacilityName?: string
  bookingDate: string
  startTime: string
  endTime: string
  reviewerNotes?: string
  reviewUrl: string
}): { subject: string; htmlBody: string } {
  const decisionLabel =
    data.action === 'approve' ? 'Approved'
      : data.action === 'decline' ? 'Declined'
      : 'Alternative Proposed'
  const color =
    data.action === 'approve' ? '#2d6a4f'
      : data.action === 'decline' ? '#9b2226'
      : '#1e6091'
  const intro =
    data.action === 'approve'
      ? `<strong>${data.actorName}</strong> (${data.actorRoleLabel}) <strong style="color:${color};">approved</strong> the mismatch booking <strong>${data.bookingReference}</strong>. No further action is required from the team.`
      : data.action === 'decline'
      ? `<strong>${data.actorName}</strong> (${data.actorRoleLabel}) <strong style="color:${color};">declined</strong> the mismatch booking <strong>${data.bookingReference}</strong>. The booking has been cancelled.`
      : `<strong>${data.actorName}</strong> (${data.actorRoleLabel}) <strong style="color:${color};">proposed an alternative</strong> for the mismatch booking <strong>${data.bookingReference}</strong>. Awaiting the faculty's response.`

  const detailRows =
    row('Booking Reference', data.bookingReference) +
    row('Requester', data.requesterName) +
    row('Original Facility', data.originalFacilityName) +
    (data.alternativeFacilityName ? row('Proposed Alternative', data.alternativeFacilityName) : '') +
    row('Date', data.bookingDate) +
    row('Time', `${data.startTime} – ${data.endTime}`) +
    row('Reviewed By', `${data.actorName} (${data.actorRoleLabel})`) +
    row('Decision', decisionLabel, true) +
    (data.reviewerNotes ? row('Reviewer Notes', data.reviewerNotes) : '')

  const body = `
    <p style="color:#555;line-height:1.6;">${intro}</p>
    ${tableWrap(detailRows)}
    <p style="color:#555;line-height:1.6;font-size:13px;">
      This is a queue-visibility notice. The booking record has already been updated.
    </p>
    ${actionButton(data.reviewUrl, 'View Review Queue')}`

  return {
    subject: `[ReserveIT] Mismatch ${decisionLabel} — ${data.bookingReference}`,
    htmlBody: wrapEmailLayout(`Mismatch Booking ${decisionLabel}`, body),
  }
}

// ── Template 2: Curriculum Upload Pending Approval ──────────────────────────
