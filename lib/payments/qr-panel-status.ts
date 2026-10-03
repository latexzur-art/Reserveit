export type QrPanelStatus = 'pending' | 'pending_review' | 'failed'

/** Whether a renter still needs to see the QR-proof submission panel for this payment. */
export function qrPanelStatus(paymentMethod: string, paymentStatus: string): QrPanelStatus | null {
  if (paymentMethod !== 'qr_manual') return null
  if (paymentStatus === 'pending' || paymentStatus === 'pending_review' || paymentStatus === 'failed') {
    return paymentStatus
  }
  return null
}
