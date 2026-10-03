import { wrapEmailLayout, row, tableWrap, actionButton } from './shared'

export function specialEventReviewRequestEmail(data: {
  reviewerName: string
  requesterName: string
  requesterRole: string
  eventName: string
  eventDate: string
  startTime: string
  endTime: string
  facilities: string
  reviewUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.reviewerName}</strong>, a <strong>Special School Event</strong> has been requested and requires your review.
    </p>
    ${tableWrap(
      row('Requested By', `${data.requesterName} (${data.requesterRole})`) +
      row('Event Name', data.eventName) +
      row('Date', data.eventDate, true) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Facilities', data.facilities)
    )}
    <p style="color:#555;line-height:1.6;">
      You can approve or decline this event. If approved, conflicting bookings will be offered the chance to reschedule.
    </p>
    ${actionButton(data.reviewUrl, 'Review Event Request')}`

  return {
    subject: `[ReserveIT] Special Event Request: ${data.eventName}`,
    htmlBody: wrapEmailLayout('Special Event Request Pending Review', body),
  }
}

// ── Special Event — Approved (to Program Head requester) ─────────────────────

export function specialEventApprovedEmail(data: {
  requesterName: string
  eventName: string
  eventDate: string
  startTime: string
  endTime: string
  facilities: string
  decidedBy: string
  notes?: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.requesterName}</strong>, your special event request has been <strong style="color:#27ae60;">approved</strong>!
    </p>
    ${tableWrap(
      row('Event Name', data.eventName) +
      row('Date', data.eventDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Facilities', data.facilities) +
      row('Approved By', data.decidedBy) +
      (data.notes ? row('Notes from Reviewer', data.notes, true) : '') +
      row('Status', '<span style="color:#27ae60;font-weight:bold;">Approved</span>', true)
    )}
    <p style="color:#555;line-height:1.6;">
      The event is now confirmed. Users with conflicting bookings have been notified and given the opportunity to reschedule.
    </p>
    ${actionButton(data.dashboardUrl, 'View My Events')}`

  return {
    subject: `[ReserveIT] Special Event Approved: ${data.eventName}`,
    htmlBody: wrapEmailLayout('Special Event Approved', body),
  }
}

// ── Special Event — Declined (to Program Head requester) ─────────────────────

export function specialEventDeclinedEmail(data: {
  requesterName: string
  eventName: string
  eventDate: string
  decidedBy: string
  reason: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.requesterName}</strong>, unfortunately your special event request has been <strong style="color:#e74c3c;">declined</strong>.
    </p>
    ${tableWrap(
      row('Event Name', data.eventName) +
      row('Date', data.eventDate) +
      row('Declined By', data.decidedBy) +
      row('Reason', data.reason, true)
    )}
    <p style="color:#555;line-height:1.6;">
      If you have questions, please reach out to the Academic Head or Building Admin directly.
    </p>
    ${actionButton(data.dashboardUrl, 'Back to Dashboard')}`

  return {
    subject: `[ReserveIT] Special Event Declined: ${data.eventName}`,
    htmlBody: wrapEmailLayout('Special Event Request Declined', body),
  }
}

// ── Special Event — Instant Published (FYI to other reviewer when AH/BA self-creates) ──

export function specialEventInstantPublishedEmail(data: {
  reviewerName: string
  creatorName: string
  creatorRole: string
  eventName: string
  eventDate: string
  startTime: string
  endTime: string
  facilities: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.reviewerName}</strong>, a special school event has been published by <strong>${data.creatorName}</strong> (${data.creatorRole}).
      This is a courtesy notification — no action is required.
    </p>
    ${tableWrap(
      row('Event Name', data.eventName) +
      row('Date', data.eventDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Facilities', data.facilities) +
      row('Published By', `${data.creatorName} (${data.creatorRole})`)
    )}
    ${actionButton(data.dashboardUrl, 'View Calendar')}`

  return {
    subject: `[ReserveIT] School Event Published: ${data.eventName}`,
    htmlBody: wrapEmailLayout('School Event Published', body),
  }
}

// ── School Event — Cancellation Requested (to Building Admin) ────────────────

export function schoolEventCancellationRequestedEmail(data: {
  reviewerName: string
  requesterName: string
  requesterRole: string
  eventName: string
  dates: string
  facilities: string
  reviewUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.reviewerName}</strong>, <strong>${data.requesterName}</strong> (${data.requesterRole})
      has requested cancellation of an active School Event block and needs your confirmation.
    </p>
    ${tableWrap(
      row('Event Name', data.eventName) +
      row('Dates', data.dates, true) +
      row('Facilities', data.facilities)
    )}
    <p style="color:#555;line-height:1.6;">
      The block stays active until you confirm or decline this request.
    </p>
    ${actionButton(data.reviewUrl, 'Review Cancellation Request')}`

  return {
    subject: `[ReserveIT] Cancellation Requested: ${data.eventName}`,
    htmlBody: wrapEmailLayout('School Event Cancellation Requested', body),
  }
}

// ── School Event — Cancellation Confirmed (to Academic Head requester) ───────

export function schoolEventCancellationConfirmedEmail(data: {
  requesterName: string
  eventName: string
  dates: string
  decidedBy: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.requesterName}</strong>, your cancellation request has been <strong style="color:#e74c3c;">confirmed</strong>.
    </p>
    ${tableWrap(
      row('Event Name', data.eventName) +
      row('Dates', data.dates) +
      row('Confirmed By', data.decidedBy) +
      row('Status', '<span style="color:#e74c3c;font-weight:bold;">Cancelled</span>', true)
    )}
    <p style="color:#555;line-height:1.6;">
      The block has been removed and any displaced bookings/schedules were already handled when the block was first approved.
    </p>
    ${actionButton(data.dashboardUrl, 'View My Events')}`

  return {
    subject: `[ReserveIT] Cancellation Confirmed: ${data.eventName}`,
    htmlBody: wrapEmailLayout('School Event Cancellation Confirmed', body),
  }
}

// ── School Event — Cancellation Declined (to Academic Head requester) ────────

export function schoolEventCancellationDeclinedEmail(data: {
  requesterName: string
  eventName: string
  dates: string
  decidedBy: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.requesterName}</strong>, your cancellation request has been <strong style="color:#27ae60;">declined</strong>.
      The event block stays active.
    </p>
    ${tableWrap(
      row('Event Name', data.eventName) +
      row('Dates', data.dates) +
      row('Declined By', data.decidedBy) +
      row('Status', '<span style="color:#27ae60;font-weight:bold;">Still Active</span>', true)
    )}
    ${actionButton(data.dashboardUrl, 'View My Events')}`

  return {
    subject: `[ReserveIT] Cancellation Declined: ${data.eventName}`,
    htmlBody: wrapEmailLayout('School Event Cancellation Declined', body),
  }
}

// ── Reservation Blocked — Reschedule Offer (to affected booking owner) ────────
