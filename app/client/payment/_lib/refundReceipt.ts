/**
 * Printable refund receipt HTML for a client payment refund, opened in a
 * new tab by the payment page. Pure function — safe to unit test.
 */

import type { PaymentRecord } from './receipt'

export interface RefundRecord {
  amount: number
  reference_number: string | null
  screenshot_url: string | null
  destination_name: string
  destination_contact_number: string
  recorded_at: string
  recorded_by_name: string
  trigger_type: 'cancellation_request_entitlement' | 'ba_override'
  justification_note?: string | null
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

export function generateRefundReceiptHtml(payment: PaymentRecord, refund: RefundRecord): string {
  const safeRef = escapeHtml(refund.reference_number ?? "—")
  const safeDestName = escapeHtml(refund.destination_name)
  const safeDestContact = escapeHtml(refund.destination_contact_number)
  const safeRecordedBy = escapeHtml(refund.recorded_by_name)
  const safePaymentReference = escapeHtml(payment.payment_reference)
  const safeJustification = refund.justification_note ? escapeHtml(refund.justification_note) : null

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Refund Receipt – ${safePaymentReference}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 40px 0; }
    .receipt { max-width: 800px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; padding: 40px; }
    .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #0054A6; padding-bottom: 24px; }
    .brand-name { font-size: 28px; font-weight: 900; color: #0054A6; margin: 0; }
    .brand-name .accent { color: #FFD200; }
    .brand-sub { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin: 4px 0 0; }
    .receipt-meta { text-align: right; }
    .receipt-meta h2 { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0; }
    .ref-code { font-size: 13px; font-family: ui-monospace, Menlo, monospace; background: #f1f5f9; padding: 4px 8px; display: inline-block; margin-top: 8px; }
    .field-label { color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: 700; margin: 12px 0 2px; }
    .field-value { font-weight: 500; margin: 0; }
    .total-row { display: flex; justify-content: flex-end; border-top: 2px solid #0054A6; padding-top: 16px; margin-top: 32px; }
    .total-label { color: #64748b; text-transform: uppercase; font-size: 12px; font-weight: 700; margin-right: 16px; }
    .total-amount { font-size: 28px; font-weight: 900; color: #0054A6; }
    .generated { margin-top: 64px; text-align: center; font-size: 10px; color: #94a3b8; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; } .receipt { border: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="receipt-header">
      <div>
        <h1 class="brand-name">RESERVE<span class="accent">IT</span></h1>
        <p class="brand-sub">Lucena City University Reservation System</p>
      </div>
      <div class="receipt-meta">
        <h2>OFFICIAL REFUND RECEIPT</h2>
        <p class="ref-code">${safePaymentReference}</p>
      </div>
    </div>
    <div style="margin: 32px 0;">
      <p class="field-label">Sent To</p>
      <p class="field-value">${safeDestName} (${safeDestContact})</p>
      <p class="field-label">Refund Reference</p>
      <p class="field-value">${safeRef}</p>
      <p class="field-label">Processed By</p>
      <p class="field-value">${safeRecordedBy} on ${new Date(refund.recorded_at).toLocaleDateString("en-PH")}</p>
      ${safeJustification ? `<p class="field-label">Justification</p><p class="field-value">${safeJustification}</p>` : ""}
    </div>
    <div class="total-row">
      <span class="total-label">Total Amount Refunded</span>
      <span class="total-amount">₱${refund.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
    </div>
    <p class="generated">Generated ${new Date().toLocaleString("en-PH")}</p>
  </div>
  <script>setTimeout(() => { window.print(); }, 500);</script>
</body>
</html>`
}
