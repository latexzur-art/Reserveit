import { wrapEmailLayout, row, tableWrap, actionButton } from './shared'

export function emergencyRescheduleProposalEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  originalDate: string
  originalStart: string
  originalEnd: string
  proposedDate: string
  proposedStart: string
  proposedEnd: string
  adminMessage: string
  responseUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, the Building Admin has proposed rescheduling your paid facility booking due to an emergency situation. Please review the details below and respond as soon as possible.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Original Date', data.originalDate) +
      row('Original Time', `${data.originalStart} – ${data.originalEnd}`) +
      row('Proposed Date', `<strong style="color:#003087;">${data.proposedDate}</strong>`, true) +
      row('Proposed Time', `<strong style="color:#003087;">${data.proposedStart} – ${data.proposedEnd}</strong>`, true) +
      row('Admin Message', `<em>${data.adminMessage}</em>`, true)
    )}
    <p style="color:#555;line-height:1.6;margin-top:16px;">
      Please log in to your ReserveIT account to <strong>Accept</strong> or <strong>Decline</strong> this proposal.
      If you decline, our helpdesk will contact you to discuss further options.
    </p>
    ${actionButton(data.responseUrl, 'Review & Respond')}`

  return {
    subject: `[ACTION REQUIRED] Reschedule Proposed — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Reschedule Proposed', body),
  }
}

// ── Emergency 2: Admin notified of acceptance ──────────────────────────────────

export function emergencyRescheduleAcceptedAdminEmail(data: {
  adminName: string
  userName: string
  bookingRef: string
  facilityName: string
  newDate: string
  newStart: string
  newEnd: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.adminName}</strong>, the user has <strong style="color:#1a7a3f;">accepted</strong> the emergency reschedule proposal. The booking is now confirmed for the new schedule.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('New Date', `<strong style="color:#1a7a3f;">${data.newDate}</strong>`) +
      row('New Time', `<strong style="color:#1a7a3f;">${data.newStart} – ${data.newEnd}</strong>`) +
      row('Status', '<span style="color:#1a7a3f;font-weight:bold;">CONFIRMED</span>')
    )}`

  return {
    subject: `[ReserveIT] User Accepted Reschedule — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Reschedule Accepted', body),
  }
}

// ── Emergency 2b: User notified their acceptance is confirmed ─────────────────

export function emergencyRescheduleAcceptedUserEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  newDate: string
  newStart: string
  newEnd: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, you have <strong style="color:#1a7a3f;">accepted</strong> the emergency reschedule. Your booking is now confirmed for the new schedule below.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('New Date', `<strong style="color:#1a7a3f;">${data.newDate}</strong>`) +
      row('New Time', `<strong style="color:#1a7a3f;">${data.newStart} – ${data.newEnd}</strong>`) +
      row('Status', '<span style="color:#1a7a3f;font-weight:bold;">CONFIRMED</span>')
    )}
    <p style="color:#555;line-height:1.6;margin-top:16px;">
      No further action is needed. Please arrive at the facility on the new date and time.
    </p>`

  return {
    subject: `[ReserveIT] Reschedule Confirmed — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Reschedule Confirmed', body),
  }
}

// ── Emergency 3: Admin notified of decline ─────────────────────────────────────

export function emergencyRescheduleDeclinedAdminEmail(data: {
  adminName: string
  userName: string
  bookingRef: string
  facilityName: string
  originalDate: string
  originalStart: string
  originalEnd: string
  adminPanelUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.adminName}</strong>, the user <strong>${data.userName}</strong> has <strong style="color:#c0392b;">declined</strong> the emergency reschedule proposal. Immediate action is required.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Original Date', data.originalDate) +
      row('Original Time', `${data.originalStart} – ${data.originalEnd}`) +
      row('User Decision', '<span style="color:#c0392b;font-weight:bold;">DECLINED</span>', true)
    )}
    <p style="color:#555;line-height:1.6;margin-top:16px;">
      Please contact the user by phone to discuss further options. You may also put the booking <strong>On Hold</strong> while the discussion takes place, or proceed to <strong>Cancel with Refund</strong> once resolved.
    </p>
    ${actionButton(data.adminPanelUrl, 'Open Admin Panel')}`

  return {
    subject: `[ACTION REQUIRED] User Declined Reschedule — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Reschedule Declined by User', body),
  }
}

// ── Emergency 4: User notified of decline — with helpdesk contact ──────────────

export function emergencyRescheduleDeclinedUserEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  helpdeskPhone: string
  declineMessage: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your decline response for booking <strong>${data.bookingRef}</strong> has been recorded.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Original Date', data.bookingDate) +
      row('Original Time', `${data.startTime} – ${data.endTime}`)
    )}
    <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 8px;color:#856404;font-weight:bold;">Message from Building Admin:</p>
      <p style="margin:0;color:#555;line-height:1.6;">${data.declineMessage}</p>
    </div>
    <div style="background:#e8f0fe;border-left:4px solid #003087;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 4px;color:#003087;font-weight:bold;font-size:15px;">Helpdesk Contact</p>
      <p style="margin:0;color:#003087;font-size:20px;font-weight:bold;">${data.helpdeskPhone}</p>
      <p style="margin:4px 0 0;color:#555;font-size:13px;">Please call us to discuss further options regarding your booking.</p>
    </div>`

  return {
    subject: `[ReserveIT] Your Response Has Been Recorded — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Response Recorded — Please Contact Helpdesk', body),
  }
}

// ── Emergency 5: User notified booking is on hold ─────────────────────────────

export function emergencyOnHoldEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  helpdeskPhone: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your booking <strong>${data.bookingRef}</strong> has been placed <strong>On Hold</strong> while our team works to find a resolution.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Status', '<span style="color:#7c3aed;font-weight:bold;">ON HOLD</span>')
    )}
    <p style="color:#555;line-height:1.6;margin-top:16px;">
      Our team will contact you shortly. If you need to reach us immediately, please call our helpdesk.
    </p>
    <div style="background:#e8f0fe;border-left:4px solid #003087;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 4px;color:#003087;font-weight:bold;">Helpdesk Contact</p>
      <p style="margin:0;color:#003087;font-size:20px;font-weight:bold;">${data.helpdeskPhone}</p>
    </div>`

  return {
    subject: `[ReserveIT] Your Booking is On Hold — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Booking On Hold', body),
  }
}

// ── Emergency 6: User notified of refund cancellation ─────────────────────────

export function emergencyRefundCancellationEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  originalDate: string
  startTime: string
  endTime: string
  cancelMessage: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, we regret to inform you that your booking has been cancelled due to a force majeure event.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Original Date', data.originalDate) +
      row('Original Time', `${data.startTime} – ${data.endTime}`) +
      row('Status', '<span style="color:#c0392b;font-weight:bold;">CANCELLED — REFUND PROCESSING</span>', true)
    )}
    <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 8px;color:#856404;font-weight:bold;">Message from Building Admin:</p>
      <p style="margin:0;color:#555;line-height:1.6;">${data.cancelMessage}</p>
    </div>
    <p style="color:#555;line-height:1.6;">
      A full refund will be processed by our team. Please allow <strong>3–5 business days</strong> for the refund to be completed. Our team will contact you with further details.
    </p>`

  return {
    subject: `[ReserveIT] Booking Cancelled — Refund to be Processed — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Booking Cancelled — Refund Processing', body),
  }
}

// ── Session Credit: Issued to user ────────────────────────────────────────────

export function emergencyRequestSubmittedEmail(data: {
  adminName: string
  userName: string
  userEmail: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  bookingTime: string
  reason: string
  hasAttachment: boolean
  reviewUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.adminName}</strong>, a user has submitted an emergency cancellation request for a paid booking.
    </p>
    ${tableWrap(
      row('User', `${data.userName} (${data.userEmail})`) +
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', data.bookingTime) +
      row('Attachment', data.hasAttachment ? 'Attached' : 'None')
    )}
    <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 8px;color:#856404;font-weight:bold;">User's Reason:</p>
      <p style="margin:0;color:#555;line-height:1.6;">${data.reason}</p>
    </div>
    <p style="color:#555;line-height:1.6;">
      Please review this request and either <strong>Approve</strong> (cancel booking and issue session credit) or <strong>Deny</strong> the request.
    </p>
    ${actionButton(data.reviewUrl, 'Review Request')}`

  return {
    subject: `[ReserveIT] Emergency Cancellation Request — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Emergency Cancellation Request Submitted', body),
  }
}

// ── Emergency Request: Approved (to user) ─────────────────────────────────────

export function emergencyRequestApprovedEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  creditAmountPeso: string
  newBalancePeso: string
  reviewNotes?: string
  applyUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your emergency cancellation request for booking <strong>${data.bookingRef}</strong> has been <strong style="color:#16a34a;">approved</strong>.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Credit Issued', `<strong style="color:#16a34a;">₱${data.creditAmountPeso}</strong>`) +
      row('New Balance', `<strong>₱${data.newBalancePeso}</strong>`) +
      row('Booking Status', '<span style="color:#c0392b;font-weight:bold;">CANCELLED</span>', true)
    )}
    ${data.reviewNotes ? `
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 8px;color:#166534;font-weight:bold;">Admin Note:</p>
      <p style="margin:0;color:#555;line-height:1.6;">${data.reviewNotes}</p>
    </div>` : ''}
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 6px;color:#166534;font-weight:bold;">Important</p>
      <p style="margin:0;color:#166534;line-height:1.6;">
        Your session credit is <strong>not a cash refund</strong>. It can be applied toward any future paid booking at checkout.
      </p>
    </div>
    ${actionButton(data.applyUrl, 'Use Your Credit')}`

  return {
    subject: `[ReserveIT] Emergency Request Approved — ₱${data.creditAmountPeso} Credit Issued`,
    htmlBody: wrapEmailLayout('Emergency Cancellation Approved', body),
  }
}

// ── Emergency Request: Denied (to user) ──────────────────────────────────────

export function emergencyRequestDeniedEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  bookingTime: string
  reviewNotes: string
  helpdeskPhone: string
  helpdeskEmail: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, we regret to inform you that your emergency cancellation request for booking <strong>${data.bookingRef}</strong> has been <strong style="color:#c0392b;">denied</strong>.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', data.bookingTime) +
      row('Request Status', '<span style="color:#c0392b;font-weight:bold;">DENIED</span>', true)
    )}
    <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 8px;color:#856404;font-weight:bold;">Admin Note:</p>
      <p style="margin:0;color:#555;line-height:1.6;">${data.reviewNotes}</p>
    </div>
    <p style="color:#555;line-height:1.6;">
      Your booking remains <strong>active</strong>. If you believe this decision should be reconsidered, please contact our Helpdesk directly.
    </p>
    <div style="background:#e8f0fe;border-left:4px solid #003087;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 4px;color:#003087;font-weight:bold;">Helpdesk Contact</p>
      <p style="margin:0;color:#003087;font-size:16px;font-weight:bold;">${data.helpdeskPhone}</p>
      <p style="margin:4px 0 0;color:#003087;">${data.helpdeskEmail}</p>
    </div>`

  return {
    subject: `[ReserveIT] Emergency Request Denied — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Emergency Cancellation Request Denied', body),
  }
}

// ─── Emergency Reschedule Request: Submitted (to building admins) ─────────────

// ─── Ask User to Reschedule ──────────────────────────────────────────────────

export function askUserToRescheduleEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  message: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, the Building Admin has requested that you reschedule your booking.
    </p>
    ${tableWrap(
      row('Booking', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Message', data.message)
    )}
    <p style="color:#555;line-height:1.6;margin-top:16px;">
      Please log in and pick a new date and time from the available slots. Your booking is currently on hold until you reschedule.
    </p>`
  return {
    subject: `[ACTION REQUIRED] Please Reschedule — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Reschedule Requested by Building Admin', body),
  }
}
