import { wrapEmailLayout, row, tableWrap, actionButton } from './shared'

export function bookerPaidBookingSubmittedEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  duration: string
  purpose: string
  paymentUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your gymnasium booking has been <strong>approved</strong>! To confirm your reservation, please complete the payment using the button below.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Duration', data.duration) +
      row('Purpose', data.purpose) +
      row('Status', '<span style="color:#856404;font-weight:bold;">PENDING PAYMENT</span>')
    )}
    ${actionButton(data.paymentUrl, 'Complete Payment Now')}
    <p style="color:#888;font-size:13px;margin-top:16px;">
      Your slot is reserved while your payment is pending. If payment is not completed, the booking will be released.
    </p>`

  return {
    subject: `[ACTION REQUIRED] Complete Payment for Your Booking — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Payment Required — Complete Your Booking', body),
  }
}

// ── Booker: Payment Confirmed ─────────────────────────────────────────────────

export function bookerPaymentConfirmedEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  amountPaid: string
  receiptUrl?: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your payment has been received and your reservation is now <strong style="color:#1a7a3f;">confirmed</strong>!
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Amount Paid', `<span style="color:#1a7a3f;font-weight:bold;">${data.amountPaid}</span>`) +
      row('Status', '<span style="color:#1a7a3f;font-weight:bold;">CONFIRMED</span>')
    )}
    ${data.receiptUrl ? actionButton(data.receiptUrl, 'View Receipt') : ''}
    <p style="color:#555;line-height:1.6;margin-top:8px;">
      Please arrive 5–10 minutes early and bring a valid ID. You will receive a reminder before your booking starts.
    </p>`

  return {
    subject: `Booking Confirmed — ${data.facilityName} on ${data.bookingDate} (${data.bookingRef})`,
    htmlBody: wrapEmailLayout('Booking Confirmed — Payment Received', body),
  }
}

// ── Building Admin: Paid Booking Submitted ────────────────────────────────────

export function buildingAdminPaidBookingSubmittedEmail(data: {
  bookingRef: string
  requesterName: string
  requesterEmail: string
  requesterRole: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  duration: string
  purpose: string
  adminPanelUrl: string
  submittedAt: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      A <strong>paid gymnasium booking</strong> has been submitted and is awaiting payment before it can be confirmed. No action is required from you yet — this is a heads-up so you can prepare for the incoming payment.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Submitted By', `${data.requesterName} (${data.requesterRole}) — ${data.requesterEmail}`) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Duration', data.duration) +
      row('Purpose', data.purpose) +
      row('Status', '<span style="color:#856404;font-weight:bold;">PENDING PAYMENT</span>') +
      row('Submitted At', data.submittedAt)
    )}
    <p style="color:#555;line-height:1.6;margin-top:8px;">
      Once the requester completes payment, you will receive a confirmation email and the reservation will be automatically approved.
    </p>
    ${actionButton(data.adminPanelUrl, 'View Booking in Admin Panel')}`

  return {
    subject: `[ReserveIT] Paid Booking Submitted — ${data.facilityName} on ${data.bookingDate}`,
    htmlBody: wrapEmailLayout('Paid Booking Submitted — Pending Payment', body),
  }
}

// ── Building Admin: Payment Completed ────────────────────────────────────────

export function buildingAdminPaymentCompletedEmail(data: {
  bookingRef: string
  requesterName: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  amountPaid: string
  adminPanelUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Payment has been <strong style="color:#1a7a3f;">successfully received</strong> for a gymnasium booking. The reservation is now confirmed and active.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Requester', data.requesterName) +
      row('Facility', data.facilityName) +
      row('Date', data.bookingDate) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Amount Paid', `<span style="color:#1a7a3f;font-weight:bold;">${data.amountPaid}</span>`) +
      row('Status', '<span style="color:#1a7a3f;font-weight:bold;">CONFIRMED</span>')
    )}
    ${actionButton(data.adminPanelUrl, 'View Booking in Admin Panel')}`

  return {
    subject: `[ReserveIT] Payment Received — ${data.facilityName} on ${data.bookingDate} (${data.bookingRef})`,
    htmlBody: wrapEmailLayout('Payment Received — Reservation Confirmed', body),
  }
}

// ── Booker: QR Proof Rejected ───────────────────────────────────────────────

export function bookerQrProofRejectedEmail(data: {
  userName: string
  bookingRef: string
  reason: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, the payment proof you submitted for booking <strong>${data.bookingRef}</strong> could not be verified.
    </p>
    ${tableWrap(row('Reason', data.reason))}
    <p style="color:#555;line-height:1.6;margin-top:8px;">
      Please review the details and resubmit your reference number and/or screenshot from your payment page.
    </p>`
  return {
    subject: `[ACTION REQUIRED] Payment Proof Rejected — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Payment Proof Rejected — Please Resubmit', body),
  }
}

// ── Building Admin: QR Proof Submitted ──────────────────────────────────────

export function buildingAdminQrProofSubmittedEmail(data: {
  bookingRef: string
  payerName: string
  referenceNumber: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      A renter submitted QR payment proof for booking <strong>${data.bookingRef}</strong> awaiting your review.
    </p>
    ${tableWrap(
      row('Payer Name', data.payerName) +
      row('Reference #', `<strong>${data.referenceNumber}</strong>`)
    )}`
  return {
    subject: `[REVIEW] QR Payment Proof Submitted — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('QR Payment Awaiting Review', body),
  }
}

// ── Booker: Refund Sent ─────────────────────────────────────────────────────

export function bookerRefundSentEmail(data: {
  userName: string
  bookingRef: string
  amount: string
  referenceNumber?: string
  destinationName: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your refund for booking <strong>${data.bookingRef}</strong> has been sent.
    </p>
    ${tableWrap(
      row('Amount Refunded', `<span style="color:#1a7a3f;font-weight:bold;">${data.amount}</span>`) +
      row('Sent To', data.destinationName) +
      (data.referenceNumber ? row('Reference #', data.referenceNumber) : '')
    )}
    <p style="color:#888;font-size:13px;margin-top:16px;">
      A printable refund receipt is available on your payment page.
    </p>`
  return {
    subject: `Refund Sent — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Refund Processed', body),
  }
}

// ── Booker: Refund Proof Uploaded (awaiting confirmation) ────────────────────

export function bookerRefundProofEmail(data: {
  userName: string
  bookingRef: string
  amount: string
  referenceNumber: string
  receiptUrl?: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your refund for booking <strong>${data.bookingRef}</strong> has been processed.
    </p>
    ${tableWrap(
      row('Refund Amount', `<span style="color:#1a7a3f;font-weight:bold;">${data.amount}</span>`) +
      row('Reference #', data.referenceNumber)
    )}
    ${data.receiptUrl ? actionButton(data.receiptUrl, 'View Refund Receipt') : ''}
    <p style="color:#555;line-height:1.6;margin-top:16px;">
      Please log in to your payment page to confirm receipt of this refund. If you did not receive the payment, you can dispute it from the same page.
    </p>`
  return {
    subject: `[ACTION REQUIRED] Confirm Refund Receipt — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Refund Processed — Please Confirm', body),
  }
}

// ── Building Admin: Refund Owed ─────────────────────────────────────────────

export function buildingAdminRefundOwedEmail(data: {
  bookingRef: string
  amount: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      A cancellation was approved for a paid booking (<strong>${data.bookingRef}</strong>) and is refund-eligible.
    </p>
    ${tableWrap(row('Amount Owed', `<strong>${data.amount}</strong>`))}
    <p style="color:#555;line-height:1.6;">Please process this refund in Payment Management.</p>`
  return {
    subject: `[ACTION REQUIRED] Refund Owed — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Refund Owed — Cancellation Approved', body),
  }
}

// ── Booker: BA Cancellation Proposed ────────────────────────────────────────

export function cancellationProposedToBookerEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  amount: string
  reason: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, the Building Admin has proposed cancelling your booking.
    </p>
    ${tableWrap(
      row('Booking', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Refund Amount', `<span style="color:#1a7a3f;font-weight:bold;">${data.amount}</span>`) +
      row('Reason', data.reason)
    )}
    <p style="color:#555;line-height:1.6;margin-top:16px;">
      If you accept, you will be asked to provide your refund destination details (account name, number, contact).
      If you dispute, the Building Admin will contact you directly.
    </p>
    <p style="color:#c0392b;font-weight:bold;font-size:13px;margin-top:12px;">
      Please respond as soon as possible. Your booking remains active until you accept or dispute.
    </p>`
  return {
    subject: `[ACTION REQUIRED] Cancellation Proposed — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Cancellation Proposed by Building Admin', body),
  }
}

// ── Refund Disputed by Client ──────────────────────────────────────────────

export function refundDisputedEmail(data: {
  bookingRef: string
  amount: string
  userName: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      A client has <strong style="color:#c0392b;">disputed</strong> a refund for booking <strong>${data.bookingRef}</strong>. They report they did not receive the payment.
    </p>
    ${tableWrap(
      row('Booking', `<strong>${data.bookingRef}</strong>`) +
      row('Refund Amount', `<strong>${data.amount}</strong>`) +
      row('Status', '<span style="color:#c0392b;font-weight:bold;">DISPUTED</span>')
    )}
    <p style="color:#555;line-height:1.6;">
      Please review the dispute in Payment Management and re-upload corrected proof or contact the client directly.
    </p>`
  return {
    subject: `[URGENT] Refund Disputed — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Refund Disputed by Client', body),
  }
}

// ── Cancellation Request Rejected ──────────────────────────────────────────

export function cancellationRequestRejectedEmail(data: {
  userName: string
  bookingRef: string
  reason: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your cancellation request for booking <strong>${data.bookingRef}</strong> has been <strong style="color:#c0392b;">rejected</strong> by the Building Admin.
    </p>
    ${tableWrap(
      row('Booking', `<strong>${data.bookingRef}</strong>`) +
      row('Status', '<span style="color:#c0392b;font-weight:bold;">REJECTED</span>') +
      row('Reason', data.reason)
    )}
    <p style="color:#555;line-height:1.6;">
      Your booking remains active. If you still wish to cancel, you may submit a new cancellation request with additional details.
    </p>`
  return {
    subject: `Cancellation Request Rejected — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Cancellation Request Rejected', body),
  }
}

// ── Cancellation Request Approved ──────────────────────────────────────────

export function cancellationRequestApprovedEmail(data: {
  userName: string
  bookingRef: string
  refundOwed: boolean
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your cancellation request for booking <strong>${data.bookingRef}</strong> has been <strong style="color:#27ae60;">approved</strong>.
    </p>
    ${tableWrap(
      row('Booking', `<strong>${data.bookingRef}</strong>`) +
      row('Status', '<span style="color:#27ae60;font-weight:bold;">CANCELLED</span>') +
      (data.refundOwed ? row('Refund', '<span style="color:#27ae60;font-weight:bold;">Your refund is being processed.</span>') : '')
    )}
    ${data.refundOwed ? '<p style="color:#555;line-height:1.6;">You will receive a separate notification once the refund has been sent.</p>' : ''}`
  return {
    subject: `Cancellation Approved — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Cancellation Request Approved', body),
  }
}

// ── Reschedule Downgrade — Credit Owed to BA ───────────────────────────────

export function downgradeCreditOwedEmail(data: {
  bookingRef: string
  originalAmount: string
  newAmount: string
  creditAmount: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      A user rescheduled booking <strong>${data.bookingRef}</strong> to a cheaper time slot. A partial credit is owed.
    </p>
    ${tableWrap(
      row('Booking', `<strong>${data.bookingRef}</strong>`) +
      row('Original Amount', data.originalAmount) +
      row('New Amount', data.newAmount) +
      row('Credit Owed', `<strong style="color:#e67e22;">${data.creditAmount}</strong>`)
    )}
    <p style="color:#555;line-height:1.6;">Please process the credit or refund in Payment Management.</p>`
  return {
    subject: `[ReserveIT] Downgrade Credit Owed — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Reschedule Downgrade — Credit Owed', body),
  }
}

// ── Extension Payment Confirmed ────────────────────────────────────────────

export function extensionPaymentConfirmedEmail(data: {
  userName: string
  bookingRef: string
  endTime: string
  amountPaid: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your extension payment for booking <strong>${data.bookingRef}</strong> has been received. Your booking has been extended!
    </p>
    ${tableWrap(
      row('Booking', `<strong>${data.bookingRef}</strong>`) +
      row('New End Time', `<strong>${data.endTime}</strong>`) +
      row('Amount Paid', `<span style="color:#1a7a3f;font-weight:bold;">${data.amountPaid}</span>`) +
      row('Status', '<span style="color:#1a7a3f;font-weight:bold;">EXTENDED</span>')
    )}
    <p style="color:#555;line-height:1.6;">
      Your booking end time has been updated. Please arrive before the new end time.
    </p>`
  return {
    subject: `Booking Extended — ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Extension Payment Confirmed', body),
  }
}

// ── Schedule Email 2: Schedule Returned for Revision ─────────────────────────
