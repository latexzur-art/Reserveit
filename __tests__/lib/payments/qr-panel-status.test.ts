import { describe, it, expect } from 'vitest'
import { qrPanelStatus } from '@/lib/payments/qr-panel-status'

describe('qrPanelStatus', () => {
  it('returns null for a non-qr payment method', () => {
    expect(qrPanelStatus('paymongo_card', 'pending')).toBeNull()
  })

  it('returns the status for a qr_manual payment awaiting proof', () => {
    expect(qrPanelStatus('qr_manual', 'pending')).toBe('pending')
  })

  it('returns the status for a qr_manual payment under review', () => {
    expect(qrPanelStatus('qr_manual', 'pending_review')).toBe('pending_review')
  })

  it('returns the status for a rejected qr_manual payment', () => {
    expect(qrPanelStatus('qr_manual', 'failed')).toBe('failed')
  })

  it('returns null for a qr_manual payment already completed', () => {
    expect(qrPanelStatus('qr_manual', 'completed')).toBeNull()
  })

  it('returns null for a qr_manual payment in refund_requested (nothing left to submit)', () => {
    expect(qrPanelStatus('qr_manual', 'refund_requested')).toBeNull()
  })
})
