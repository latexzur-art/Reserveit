import { wrapEmailLayout, row, tableWrap, actionButton } from './shared'

export function rescheduleRequestSubmittedEmail(data: {
  adminName: string
  userName: string
  userEmail: string
  bookingRef: string
  facilityName: string
  originalDate: string
  originalTime: string
  proposedDate: string
  proposedTime: string
  extraAmountPeso: string
  reason: string
  hasAttachment: boolean
  reviewUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.adminName}</strong>, a user has submitted an <strong>emergency reschedule request</strong> that requires your review.
    </p>
    ${tableWrap(
      row('Submitted By', `${data.userName} &lt;${data.userEmail}&gt;`) +
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Original Schedule', `${data.originalDate}, ${data.originalTime}`) +
      row('Proposed Schedule', `<strong>${data.proposedDate}, ${data.proposedTime}</strong>`) +
      row('Extra Charge', data.extraAmountPeso === '0.00' ? 'None' : `<strong style="color:#e67e22;">₱${data.extraAmountPeso}</strong>`) +
      row('Attachment', data.hasAttachment ? 'Yes (see request details)' : 'None', true)
    )}
    <div style="background:#f8f9fa;border-left:4px solid #003087;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 8px;color:#003087;font-weight:bold;">User's Reason</p>
      <p style="margin:0;color:#555;line-height:1.6;">${data.reason}</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${data.reviewUrl}" style="background:#003087;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">Review Request</a>
    </div>`

  return {
    subject: `[ReserveIT] Reschedule Request — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Reschedule Request Submitted', body),
  }
}

// ─── Emergency Reschedule Request: Approved — No Extra Payment (to user) ──────

export function rescheduleRequestApprovedNoExtraEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  newDate: string
  newTime: string
  reviewNotes?: string
  bookingsUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, great news! Your emergency reschedule request for booking <strong>${data.bookingRef}</strong> has been <strong style="color:#27ae60;">approved</strong> and your booking has been updated.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('New Date', `<strong>${data.newDate}</strong>`) +
      row('New Time', `<strong>${data.newTime}</strong>`) +
      row('Status', '<span style="color:#27ae60;font-weight:bold;">RESCHEDULED</span>', true)
    )}
    ${data.reviewNotes ? `
    <div style="background:#f8f9fa;border-left:4px solid #27ae60;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 8px;color:#27ae60;font-weight:bold;">Admin Note</p>
      <p style="margin:0;color:#555;line-height:1.6;">${data.reviewNotes}</p>
    </div>` : ''}
    <div style="text-align:center;margin:28px 0;">
      <a href="${data.bookingsUrl}" style="background:#003087;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">View My Bookings</a>
    </div>`

  return {
    subject: `[ReserveIT] Reschedule Approved — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Reschedule Request Approved', body),
  }
}

// ─── Emergency Reschedule Request: Approved — Extra Payment Required (to user) ─

export function rescheduleRequestApprovedWithExtraEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  proposedDate: string
  proposedTime: string
  extraAmountPeso: string
  reviewNotes?: string
  paymentUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your emergency reschedule request for booking <strong>${data.bookingRef}</strong> has been <strong style="color:#27ae60;">approved</strong>. To confirm the reschedule, please complete the extra payment below.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Proposed Date', `<strong>${data.proposedDate}</strong>`) +
      row('Proposed Time', `<strong>${data.proposedTime}</strong>`) +
      row('Extra Charge', `<strong style="color:#e67e22;">₱${data.extraAmountPeso}</strong>`) +
      row('Status', '<span style="color:#e67e22;font-weight:bold;">AWAITING EXTRA PAYMENT</span>', true)
    )}
    <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 8px;color:#856404;font-weight:bold;">Action Required</p>
      <p style="margin:0;color:#555;line-height:1.6;">
        Please pay the extra charge of <strong>₱${data.extraAmountPeso}</strong> via your payment page to confirm the reschedule. Your booking will remain on its original schedule until payment is completed.
      </p>
    </div>
    ${data.reviewNotes ? `
    <div style="background:#f8f9fa;border-left:4px solid #003087;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 8px;color:#003087;font-weight:bold;">Admin Note</p>
      <p style="margin:0;color:#555;line-height:1.6;">${data.reviewNotes}</p>
    </div>` : ''}
    <div style="text-align:center;margin:28px 0;">
      <a href="${data.paymentUrl}" style="background:#e67e22;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">Pay Extra Charge</a>
    </div>`

  return {
    subject: `[ReserveIT] Reschedule Approved — Extra Payment Required — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Reschedule Request Approved — Action Required', body),
  }
}

// ─── Emergency Reschedule Request: Declined (to user) ─────────────────────────

export function rescheduleRequestDeclinedEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  bookingTime: string
  reviewNotes: string
  helpdeskPhone: string
  helpdeskEmail: string
  bookingsUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, we regret to inform you that your emergency reschedule request for booking <strong>${data.bookingRef}</strong> has been <strong style="color:#c0392b;">declined</strong>.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Original Date', data.bookingDate) +
      row('Original Time', data.bookingTime) +
      row('Request Status', '<span style="color:#c0392b;font-weight:bold;">DECLINED</span>', true)
    )}
    <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 8px;color:#856404;font-weight:bold;">Admin's Reason</p>
      <p style="margin:0;color:#555;line-height:1.6;">${data.reviewNotes}</p>
    </div>
    <p style="color:#555;line-height:1.6;">
      Your booking remains <strong>active</strong> on its original schedule. If you wish to cancel your booking, you may submit an emergency cancellation request from your bookings page. If you need further assistance, please contact our Helpdesk.
    </p>
    <div style="background:#e8f0fe;border-left:4px solid #003087;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 4px;color:#003087;font-weight:bold;">Helpdesk Contact</p>
      <p style="margin:0;color:#003087;font-size:16px;font-weight:bold;">${data.helpdeskPhone}</p>
      <p style="margin:4px 0 0;color:#003087;">${data.helpdeskEmail}</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${data.bookingsUrl}" style="background:#003087;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">View My Bookings</a>
    </div>`

  return {
    subject: `[ReserveIT] Reschedule Request Declined — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Reschedule Request Declined', body),
  }
}

// ─── Reschedule Confirmed After Extra Payment (to user) ───────────────────────

export function rescheduleConfirmedAfterPaymentEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  newDate: string
  newTime: string
  paidAmountPeso: string
  bookingsUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your payment has been received and your booking <strong>${data.bookingRef}</strong> has been successfully rescheduled!
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('New Date', `<strong>${data.newDate}</strong>`) +
      row('New Time', `<strong>${data.newTime}</strong>`) +
      row('Extra Paid', `₱${data.paidAmountPeso}`) +
      row('Status', '<span style="color:#27ae60;font-weight:bold;">CONFIRMED</span>', true)
    )}
    <p style="color:#555;line-height:1.6;">
      Your booking is now confirmed on the new schedule. Please be present at the facility on the rescheduled date.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${data.bookingsUrl}" style="background:#003087;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">View My Bookings</a>
    </div>`

  return {
    subject: `[ReserveIT] Reschedule Confirmed — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Booking Reschedule Confirmed', body),
  }
}

export function reservationBlockedRescheduleOfferEmail(data: {
  userName: string
  bookingReference: string
  eventName: string
  originalDate: string
  originalStart: string
  originalEnd: string
  facilityName: string
  deadline: string
  rescheduleUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, a school event has been scheduled that affects your reservation.
      Please choose a new date and time to reschedule your booking.
    </p>
    ${tableWrap(
      row('Your Booking', data.bookingReference) +
      row('Original Date', data.originalDate, true) +
      row('Original Time', `${data.originalStart} – ${data.originalEnd}`) +
      row('Room', data.facilityName) +
      row('Blocked By Event', data.eventName) +
      row('Respond By', data.deadline, true)
    )}
    <p style="color:#555;line-height:1.6;">
      You must reschedule before the deadline or your booking will be automatically cancelled.
      You may book the same duration in any suitable room.
    </p>
    ${actionButton(data.rescheduleUrl, 'Pick a New Schedule')}`

  return {
    subject: `[ReserveIT] Action Required: Reschedule Your Booking (${data.bookingReference})`,
    htmlBody: wrapEmailLayout('Your Reservation Was Displaced — Please Reschedule', body),
  }
}

// ── Booking Rescheduled — Instant Approval Confirmation ──────────────────────

export function reservationRescheduledInstantEmail(data: {
  userName: string
  bookingReference: string
  newDate: string
  newStart: string
  newEnd: string
  newFacility: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your booking has been rescheduled and <strong style="color:#27ae60;">instantly approved</strong>.
    </p>
    ${tableWrap(
      row('Booking Reference', data.bookingReference) +
      row('New Date', data.newDate, true) +
      row('New Time', `${data.newStart} – ${data.newEnd}`) +
      row('Room', data.newFacility) +
      row('Status', '<span style="color:#27ae60;font-weight:bold;">Confirmed</span>', true)
    )}
    ${actionButton(data.dashboardUrl, 'View My Reservations')}`

  return {
    subject: `[ReserveIT] Booking Rescheduled and Confirmed (${data.bookingReference})`,
    htmlBody: wrapEmailLayout('Booking Rescheduled — Confirmed', body),
  }
}

// ── Class Schedule Blocked — Reschedule Offer (to instructor) ─────────────────

export function classScheduleBlockedRescheduleOfferEmail(data: {
  instructorName: string
  courseCode: string
  section: string
  affectedDate: string
  facilityName: string
  eventName: string
  deadline: string
  rescheduleUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.instructorName}</strong>, a school event is scheduled during one of your classes.
      Please choose a new venue and time for that session.
    </p>
    ${tableWrap(
      row('Course', `${data.courseCode} — ${data.section}`) +
      row('Affected Date', data.affectedDate, true) +
      row('Room', data.facilityName) +
      row('Blocked By', data.eventName) +
      row('Respond By', data.deadline, true)
    )}
    <p style="color:#555;line-height:1.6;">
      The rescheduled session will be instantly approved once you select a suitable room.
    </p>
    ${actionButton(data.rescheduleUrl, 'Reschedule My Class Session')}`

  return {
    subject: `[ReserveIT] Class Session Affected by School Event — ${data.courseCode} (${data.affectedDate})`,
    htmlBody: wrapEmailLayout('Class Session Displaced — Please Reschedule', body),
  }
}

// ── Reschedule Offer Expired ──────────────────────────────────────────────────

export function rescheduleOfferExpiredEmail(data: {
  userName: string
  bookingReference: string
  originalDate: string
  eventName: string
  contactUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, the reschedule window for your displaced booking has expired and the booking has been <strong style="color:#e74c3c;">cancelled</strong>.
    </p>
    ${tableWrap(
      row('Booking Reference', data.bookingReference) +
      row('Original Date', data.originalDate) +
      row('Cancelled Because', `School event: ${data.eventName}`) +
      row('Status', '<span style="color:#e74c3c;font-weight:bold;">Cancelled</span>', true)
    )}
    <p style="color:#555;line-height:1.6;">
      If you still need a room, please submit a new reservation request.
    </p>
    ${actionButton(data.contactUrl, 'Submit a New Booking')}`

  return {
    subject: `[ReserveIT] Booking Cancelled — Reschedule Window Expired (${data.bookingReference})`,
    htmlBody: wrapEmailLayout('Booking Cancelled — Reschedule Deadline Passed', body),
  }
}

// ── Admin Override of an Instant-Approved Reschedule ──────────────────────────

export function adminRescheduleOverrideEmail(data: {
  userName: string
  bookingReference: string
  newDate: string
  newStart: string
  newEnd: string
  newFacility: string
  adminName: string
  adminRole: string
  dashboardUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your recently rescheduled booking has been updated by an administrator.
    </p>
    ${tableWrap(
      row('Booking Reference', data.bookingReference) +
      row('Updated By', `${data.adminName} (${data.adminRole})`) +
      row('New Date', data.newDate, true) +
      row('New Time', `${data.newStart} – ${data.newEnd}`) +
      row('New Room', data.newFacility)
    )}
    <p style="color:#555;line-height:1.6;">
      If you have questions about this change, please contact the Building Admin.
    </p>
    ${actionButton(data.dashboardUrl, 'View My Reservations')}`

  return {
    subject: `[ReserveIT] Your Rescheduled Booking Was Updated (${data.bookingReference})`,
    htmlBody: wrapEmailLayout('Booking Updated by Administrator', body),
  }
}
