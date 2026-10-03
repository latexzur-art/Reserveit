/**
 * Blob-based receipt download utility. Creates a local HTML file download
 * instead of relying on window.open() which is blocked by popup blockers
 * on mobile and doesn't produce an actual downloadable file.
 */
import { generateReceiptHtml, type PaymentRecord } from './receipt'
import { generateRefundReceiptHtml, type RefundRecord } from './refundReceipt'

export function downloadPaymentReceipt(payment: PaymentRecord) {
  const html = generateReceiptHtml(payment)
  downloadHtml(html, `receipt-${payment.payment_reference}.html`)
}

export function downloadRefundReceipt(payment: PaymentRecord, refund: RefundRecord) {
  const html = generateRefundReceiptHtml(payment, refund)
  downloadHtml(html, `refund-${payment.payment_reference}.html`)
}

function downloadHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
