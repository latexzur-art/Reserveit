/**
 * Printable receipt HTML for a client payment, opened in a new tab by the
 * payment page. Pure function — safe to unit test.
 */

export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "refunded" | "cancelled" | "pending_review" | "refund_requested" | "refund_processing"

export interface CostLineItem {
  label: string
  hours: number
  rate: number
  subtotal: number
  isFlatFee?: boolean
}

export interface PaymentRecord {
  id: string
  booking_id?: string | null
  payment_reference: string
  amount: number
  currency: string
  payment_method: string
  payment_status: PaymentStatus
  description: string | null
  paymongo_checkout_url?: string | null
  paymongo_webhook_data?: Record<string, any> | null
  created_at: string
  updated_at: string
  qr_payer_name?: string | null
  qr_payer_contact_number?: string | null
  qr_reference_number?: string | null
  qr_review_notes?: string | null
  metadata?: {
    facility_name?: string
    booking_purpose?: string
    purpose?: string
    cost_breakdown?: CostLineItem[]
  } | null
  booking?: {
    id: string
    booking_reference: string
    booking_purpose: string
    purpose: string
    current_status: string
    organization_name?: string | null
    contact_number?: string | null
    user?: {
      full_name: string
      email: string
    } | null
  }
}

/**
 * Escapes HTML-significant characters so untrusted/user-entered values
 * (renter name, organization, contact info, payer details, etc.) can be
 * safely interpolated into the receipt's HTML template without risking
 * script injection.
 */
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function generateReceiptHtml(payment: PaymentRecord): string {
    const breakdown = payment.metadata?.cost_breakdown ?? []
    const facilityName = payment.metadata?.facility_name ?? "Gymnasium"
    const webhookData = payment.paymongo_webhook_data as any
    const billing = webhookData?.data?.attributes?.billing || {}
    const isQrPayment = payment.payment_method === 'qr_manual'
    const payerName = isQrPayment ? (payment.qr_payer_name ?? payment.booking?.user?.full_name ?? null) : (billing.name ?? payment.booking?.user?.full_name ?? null)
    const payerEmail = isQrPayment ? (payment.booking?.user?.email ?? null) : (billing.email ?? payment.booking?.user?.email ?? null)
    const payerPhone = isQrPayment ? (payment.qr_payer_contact_number ?? payment.booking?.contact_number ?? null) : (billing.phone ?? billing.number ?? payment.booking?.contact_number ?? null)
    const hasPaidBy = payerName || payerEmail || payerPhone
    const firstPayment = webhookData?.data?.attributes?.payments?.[0]
    const paymentSource = firstPayment?.data?.attributes?.source ?? firstPayment?.attributes?.source
    const sourceType = paymentSource?.type ?? null
    const webhookMethodMap: Record<string, string> = {
      gcash: 'GCash',
      paymaya: 'Maya',
      grab_pay: 'GrabPay',
      card: 'Credit / Debit Card',
      dob: 'Online Banking',
      session_credits: 'Session Credits',
    }
    const dbMethodMap: Record<string, string> = {
      paymongo_gcash: 'GCash',
      paymongo_maya: 'Maya',
      paymongo_grab: 'GrabPay',
      paymongo_card: 'Credit / Debit Card',
      cashier: 'Cash (Cashier)',
      credits: 'Session Credits',
      session_credits: 'Session Credits',
    }
    const isCreditOnly = webhookData?.credit_only === true || sourceType === 'session_credits' || payment.payment_method === 'credits' || payment.payment_method === 'session_credits'
    const paymentMethodLabel = isCreditOnly
      ? 'Session Credits'
      : (sourceType ? webhookMethodMap[sourceType] : null) ?? dbMethodMap[payment.payment_method] ?? 'Online Payment'
    const cardBrand = paymentSource?.card?.brand ?? null
    const cardLast4 = paymentSource?.card?.last4 ?? null
    const cardDetails = sourceType === 'card' && (cardBrand || cardLast4)
      ? [cardBrand ? cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1) : null, cardLast4 ? `···· ${cardLast4}` : null].filter(Boolean).join(' ')
      : null
    const lineItemsHtml = breakdown.length > 0
      ? breakdown.map(item =>
          `<tr>
            <td class="p3 label-cell">${escapeHtml(item.label)}</td>
            <td class="p3 center muted">${item.isFlatFee ? "—" : `${item.hours.toFixed(2)} hr${item.hours !== 1 ? "s" : ""}`}</td>
            <td class="p3 right muted">₱${item.rate.toLocaleString()}${item.isFlatFee ? "" : "/hr"}</td>
            <td class="p3 right strong">₱${item.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>`
        ).join("")
      : `<tr>
          <td class="p3 label-cell">Standard booking fee</td>
          <td class="p3 center muted">—</td>
          <td class="p3 right muted">—</td>
          <td class="p3 right strong">₱${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        </tr>`

    const safeRenterName = escapeHtml(payment.booking?.user?.full_name ?? "—")
    const safeOrganization = payment.booking?.organization_name ? escapeHtml(payment.booking.organization_name) : ''
    const safeContactNumber = payment.booking?.contact_number ? escapeHtml(payment.booking.contact_number) : ''
    const safePayerName = payerName ? escapeHtml(payerName) : ''
    const safePayerEmail = payerEmail ? escapeHtml(payerEmail) : ''
    const safePayerPhone = payerPhone ? escapeHtml(payerPhone) : ''
    const safeBookingReference = escapeHtml(payment.booking?.booking_reference ?? "—")
    const safeFacilityName = escapeHtml(facilityName)
    const safeBookingPurpose = escapeHtml(payment.booking?.booking_purpose ?? payment.metadata?.booking_purpose ?? "—")
    const safePaymentStatus = escapeHtml(payment.payment_status)
    const safePaymentMethodLabel = escapeHtml(paymentMethodLabel)
    const safeCardDetails = cardDetails ? escapeHtml(cardDetails) : ''
    const safePaymentReference = escapeHtml(payment.payment_reference)

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Receipt – ${safePaymentReference}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 40px 0;
    }
    .receipt {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      padding: 40px;
    }
    .receipt-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 4px solid #0054A6;
      padding-bottom: 24px;
    }
    .brand-name { font-size: 28px; font-weight: 900; color: #0054A6; margin: 0; }
    .brand-name .accent { color: #FFD200; }
    .brand-sub { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin: 4px 0 0; }
    .receipt-meta { text-align: right; }
    .receipt-meta h2 { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0; }
    .ref-code { font-size: 13px; font-family: ui-monospace, Menlo, monospace; background: #f1f5f9; padding: 4px 8px; display: inline-block; margin-top: 8px; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin: 32px 0; font-size: 14px; }
    .details-col.right { text-align: right; }
    .field-label { color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: 700; margin: 12px 0 2px; }
    .field-label:first-child { margin-top: 0; }
    .field-value-lg { font-weight: 700; font-size: 18px; margin: 0; }
    .field-value { font-weight: 500; margin: 0; }
    .field-value-sm { color: #94a3b8; font-size: 12px; margin: 0; }
    .status-badge { display: inline-block; color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
    .status-completed { background: #16a34a; }
    .status-other { background: #f97316; }
    table.line-items { width: 100%; text-align: left; font-size: 14px; margin-bottom: 40px; border-collapse: collapse; }
    table.line-items thead { background: #0054A6; color: #fff; }
    table.line-items th, table.line-items td.p3 { padding: 12px; }
    .center { text-align: center; }
    .right { text-align: right; }
    .muted { color: #64748b; }
    .strong { font-weight: 700; }
    .label-cell { font-weight: 500; color: #334155; }
    table.line-items tbody tr { border-bottom: 1px solid #e2e8f0; }
    .total-row { display: flex; justify-content: flex-end; border-top: 2px solid #0054A6; padding-top: 16px; margin-top: 32px; }
    .total-label { color: #64748b; text-transform: uppercase; font-size: 12px; font-weight: 700; margin-right: 16px; }
    .total-amount { font-size: 28px; font-weight: 900; color: #0054A6; }
    .generated { margin-top: 64px; text-align: center; font-size: 10px; color: #94a3b8; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
      .receipt { border: none; padding: 0; }
    }
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
        <h2>OFFICIAL RECEIPT</h2>
        <p class="ref-code">${safePaymentReference}</p>
      </div>
    </div>

    <div class="details-grid">
      <div>
        <p class="field-label">Renter Details</p>
        <p class="field-value-lg">${safeRenterName}</p>
        ${safeOrganization ? `<p class="field-value">${safeOrganization}</p>` : ''}
        ${safeContactNumber ? `<p class="field-value">${safeContactNumber}</p>` : ''}
        ${hasPaidBy ? `
          <p class="field-label">Paid By</p>
          ${safePayerName ? `<p class="field-value">${safePayerName}</p>` : ''}
          ${safePayerEmail ? `<p class="field-value-sm">${safePayerEmail}</p>` : ''}
          ${safePayerPhone ? `<p class="field-value-sm">${safePayerPhone}</p>` : ''}
        ` : ''}
      </div>
      <div class="details-col right">
        <p class="field-label">Booking Reference</p>
        <p class="field-value">${safeBookingReference}</p>
        <p class="field-label">Facility / Purpose</p>
        <p class="field-value">${safeFacilityName} - ${safeBookingPurpose}</p>
        <p class="field-label">Status</p>
        <span class="status-badge ${payment.payment_status === "completed" ? "status-completed" : "status-other"}">
          ${safePaymentStatus}
        </span>
        <p class="field-label">Payment Method</p>
        <p class="field-value">${safePaymentMethodLabel}</p>
        ${safeCardDetails ? `<p class="field-value-sm">${safeCardDetails}</p>` : ''}
      </div>
    </div>

    <table class="line-items">
      <thead>
        <tr>
          <th class="p3">DESCRIPTION</th>
          <th class="p3 center">DURATION</th>
          <th class="p3 right">RATE</th>
          <th class="p3 right">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
      </tbody>
    </table>

    <div class="total-row">
      <span class="total-label">Total Amount Paid</span>
      <span class="total-amount">₱${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
    </div>

    <p class="generated">Generated ${new Date().toLocaleString("en-PH")}</p>

  </div>
  <script>
    setTimeout(() => { window.print(); }, 500);
  </script>
</body>
</html>`

    return html
}
