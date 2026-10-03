import { describe, it, expect } from 'vitest'
import {
  bookerQrProofRejectedEmail, buildingAdminQrProofSubmittedEmail,
  bookerRefundSentEmail, buildingAdminRefundOwedEmail,
} from '@/backend/notifications/templates/payments'

describe('QR/refund email templates', () => {
  it('bookerQrProofRejectedEmail includes the rejection reason', () => {
    const { htmlBody, subject } = bookerQrProofRejectedEmail({ userName: 'Jane', bookingRef: 'BK-1', reason: 'Reference does not match' })
    expect(htmlBody).toContain('Reference does not match')
    expect(subject).toMatch(/rejected/i)
  })

  it('bookerRefundSentEmail includes the amount and reference', () => {
    const { htmlBody } = bookerRefundSentEmail({ userName: 'Jane', bookingRef: 'BK-1', amount: '₱500.00', referenceNumber: 'REF-9', destinationName: 'Jane' })
    expect(htmlBody).toContain('₱500.00')
    expect(htmlBody).toContain('REF-9')
  })
})
