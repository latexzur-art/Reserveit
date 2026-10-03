import { wrapEmailLayout, row, tableWrap, actionButton } from './shared'

export function sessionCreditIssuedEmail(data: {
  userName: string
  amountPeso: string
  reason: string
  newBalancePeso: string
  bookingRef?: string
  facilityName?: string
  expiresAt?: string
  applyUrl: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, a session credit of <strong>₱${data.amountPeso}</strong> has been added to your ReserveIT account.
    </p>
    ${tableWrap(
      row('Credit Amount', `<strong style="color:#16a34a;">₱${data.amountPeso}</strong>`) +
      row('Reason', data.reason) +
      (data.bookingRef ? row('Linked Booking', data.bookingRef) : '') +
      (data.facilityName ? row('Facility', data.facilityName) : '') +
      row('New Balance', `<strong>₱${data.newBalancePeso}</strong>`) +
      (data.expiresAt ? row('Expires', data.expiresAt, true) : '')
    )}
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px 20px;margin:20px 0;border-radius:4px;">
      <p style="margin:0 0 6px;color:#166534;font-weight:bold;">Important</p>
      <p style="margin:0;color:#166534;line-height:1.6;">
        This is <strong>not a cash refund</strong> to your original payment method. Your session credit can be applied toward any future paid booking on ReserveIT at checkout.
      </p>
    </div>
    ${actionButton(data.applyUrl, 'Use Your Credit')}`

  return {
    subject: `[ReserveIT] Session Credit Issued — ₱${data.amountPeso}`,
    htmlBody: wrapEmailLayout('Session Credit Issued', body),
  }
}

// ── Session Credit: Applied at checkout ──────────────────────────────────────

export function sessionCreditAppliedEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  appliedPeso: string
  paidViaPaymongoPeso: string
  remainingBalancePeso: string
  receiptDate: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Hi <strong>${data.userName}</strong>, your session credit has been successfully applied to booking <strong>${data.bookingRef}</strong>.
    </p>
    ${tableWrap(
      row('Reference #', `<strong>${data.bookingRef}</strong>`) +
      row('Facility', data.facilityName) +
      row('Credit Applied', `<strong style="color:#16a34a;">₱${data.appliedPeso}</strong>`) +
      row('Paid via PayMongo', `₱${data.paidViaPaymongoPeso}`) +
      row('Remaining Credit Balance', `<strong>₱${data.remainingBalancePeso}</strong>`) +
      row('Receipt Date', data.receiptDate)
    )}`

  return {
    subject: `[ReserveIT] Credit Applied — Receipt for ${data.bookingRef}`,
    htmlBody: wrapEmailLayout('Session Credit Applied — Receipt', body),
  }
}

// ── Emergency Request: Submitted (to admin) ───────────────────────────────────
