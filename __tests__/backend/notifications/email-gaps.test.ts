import { describe, it, expect } from 'vitest'
import {
  refundDisputedEmail,
  cancellationRequestRejectedEmail,
  cancellationRequestApprovedEmail,
  downgradeCreditOwedEmail,
  extensionPaymentConfirmedEmail,
} from '@/backend/notifications/templates/payments'

describe('Email gap templates', () => {
  // ── Gap 1: Refund Disputed ──────────────────────────────────────────────

  describe('refundDisputedEmail', () => {
    const data = {
      bookingRef: 'BK-2026-099',
      amount: '₱1,500.00',
      userName: 'Client',
    }

    it('subject contains URGENT tag and booking ref', () => {
      const { subject } = refundDisputedEmail(data)
      expect(subject).toContain('[URGENT]')
      expect(subject).toContain('BK-2026-099')
    })

    it('body contains booking reference', () => {
      const { htmlBody } = refundDisputedEmail(data)
      expect(htmlBody).toContain('BK-2026-099')
    })

    it('body contains the refund amount', () => {
      const { htmlBody } = refundDisputedEmail(data)
      expect(htmlBody).toContain('₱1,500.00')
    })

    it('body contains DISPUTED status', () => {
      const { htmlBody } = refundDisputedEmail(data)
      expect(htmlBody).toContain('DISPUTED')
    })

    it('body contains word disputed in copy', () => {
      const { htmlBody } = refundDisputedEmail(data)
      expect(htmlBody).toMatch(/disputed/i)
    })

    it('produces valid HTML with doctype', () => {
      const { htmlBody } = refundDisputedEmail(data)
      expect(htmlBody).toContain('<!DOCTYPE html>')
      expect(htmlBody).toContain('</html>')
    })
  })

  // ── Gap 2: Cancellation Request Rejected ────────────────────────────────

  describe('cancellationRequestRejectedEmail', () => {
    const data = {
      userName: 'Maria Santos',
      bookingRef: 'BK-2026-050',
      reason: 'Booking is within the non-refundable window',
    }

    it('subject contains booking ref', () => {
      const { subject } = cancellationRequestRejectedEmail(data)
      expect(subject).toContain('BK-2026-050')
    })

    it('subject signals rejection', () => {
      const { subject } = cancellationRequestRejectedEmail(data)
      expect(subject).toMatch(/rejected/i)
    })

    it('body contains user name', () => {
      const { htmlBody } = cancellationRequestRejectedEmail(data)
      expect(htmlBody).toContain('Maria Santos')
    })

    it('body contains booking reference', () => {
      const { htmlBody } = cancellationRequestRejectedEmail(data)
      expect(htmlBody).toContain('BK-2026-050')
    })

    it('body contains the rejection reason', () => {
      const { htmlBody } = cancellationRequestRejectedEmail(data)
      expect(htmlBody).toContain('non-refundable window')
    })

    it('body contains REJECTED status', () => {
      const { htmlBody } = cancellationRequestRejectedEmail(data)
      expect(htmlBody).toContain('REJECTED')
    })

    it('produces valid HTML with doctype', () => {
      const { htmlBody } = cancellationRequestRejectedEmail(data)
      expect(htmlBody).toContain('<!DOCTYPE html>')
      expect(htmlBody).toContain('</html>')
    })
  })

  // ── Gap 3: Cancellation Request Approved ────────────────────────────────

  describe('cancellationRequestApprovedEmail', () => {
    it('subject contains booking ref', () => {
      const { subject } = cancellationRequestApprovedEmail({
        userName: 'Juan', bookingRef: 'BK-2026-060', refundOwed: false,
      })
      expect(subject).toContain('BK-2026-060')
    })

    it('subject signals approval', () => {
      const { subject } = cancellationRequestApprovedEmail({
        userName: 'Juan', bookingRef: 'BK-2026-060', refundOwed: false,
      })
      expect(subject).toMatch(/approved/i)
    })

    it('body contains CANCELLED status', () => {
      const { htmlBody } = cancellationRequestApprovedEmail({
        userName: 'Juan', bookingRef: 'BK-2026-060', refundOwed: false,
      })
      expect(htmlBody).toContain('CANCELLED')
    })

    it('body shows refund info when refundOwed is true', () => {
      const { htmlBody } = cancellationRequestApprovedEmail({
        userName: 'Juan', bookingRef: 'BK-2026-060', refundOwed: true,
      })
      expect(htmlBody).toMatch(/refund/i)
      expect(htmlBody).toContain('being processed')
    })

    it('body omits refund info when refundOwed is false', () => {
      const { htmlBody } = cancellationRequestApprovedEmail({
        userName: 'Juan', bookingRef: 'BK-2026-060', refundOwed: false,
      })
      expect(htmlBody).not.toContain('being processed')
    })

    it('produces valid HTML with doctype', () => {
      const { htmlBody } = cancellationRequestApprovedEmail({
        userName: 'Juan', bookingRef: 'BK-2026-060', refundOwed: false,
      })
      expect(htmlBody).toContain('<!DOCTYPE html>')
      expect(htmlBody).toContain('</html>')
    })
  })

  // ── Gap 4: Downgrade Credit Owed ────────────────────────────────────────

  describe('downgradeCreditOwedEmail', () => {
    const data = {
      bookingRef: 'BK-2026-070',
      originalAmount: '₱2,000.00',
      newAmount: '₱1,500.00',
      creditAmount: '₱500.00',
    }

    it('subject contains ReserveIT tag and booking ref', () => {
      const { subject } = downgradeCreditOwedEmail(data)
      expect(subject).toContain('[ReserveIT]')
      expect(subject).toContain('BK-2026-070')
    })

    it('subject mentions downgrade credit', () => {
      const { subject } = downgradeCreditOwedEmail(data)
      expect(subject).toMatch(/credit/i)
    })

    it('body contains booking reference', () => {
      const { htmlBody } = downgradeCreditOwedEmail(data)
      expect(htmlBody).toContain('BK-2026-070')
    })

    it('body contains original amount', () => {
      const { htmlBody } = downgradeCreditOwedEmail(data)
      expect(htmlBody).toContain('₱2,000.00')
    })

    it('body contains new amount', () => {
      const { htmlBody } = downgradeCreditOwedEmail(data)
      expect(htmlBody).toContain('₱1,500.00')
    })

    it('body contains credit amount', () => {
      const { htmlBody } = downgradeCreditOwedEmail(data)
      expect(htmlBody).toContain('₱500.00')
    })

    it('produces valid HTML with doctype', () => {
      const { htmlBody } = downgradeCreditOwedEmail(data)
      expect(htmlBody).toContain('<!DOCTYPE html>')
      expect(htmlBody).toContain('</html>')
    })
  })

  // ── Gap 5: Extension Payment Confirmed ──────────────────────────────────

  describe('extensionPaymentConfirmedEmail', () => {
    const data = {
      userName: 'Pedro Reyes',
      bookingRef: 'BK-2026-080',
      endTime: '5:00 PM',
      amountPaid: '₱750.00',
    }

    it('subject contains booking ref', () => {
      const { subject } = extensionPaymentConfirmedEmail(data)
      expect(subject).toContain('BK-2026-080')
    })

    it('subject signals extension', () => {
      const { subject } = extensionPaymentConfirmedEmail(data)
      expect(subject).toMatch(/extended/i)
    })

    it('body contains user name', () => {
      const { htmlBody } = extensionPaymentConfirmedEmail(data)
      expect(htmlBody).toContain('Pedro Reyes')
    })

    it('body contains new end time', () => {
      const { htmlBody } = extensionPaymentConfirmedEmail(data)
      expect(htmlBody).toContain('5:00 PM')
    })

    it('body contains amount paid', () => {
      const { htmlBody } = extensionPaymentConfirmedEmail(data)
      expect(htmlBody).toContain('₱750.00')
    })

    it('body contains EXTENDED status', () => {
      const { htmlBody } = extensionPaymentConfirmedEmail(data)
      expect(htmlBody).toContain('EXTENDED')
    })

    it('produces valid HTML with doctype', () => {
      const { htmlBody } = extensionPaymentConfirmedEmail(data)
      expect(htmlBody).toContain('<!DOCTYPE html>')
      expect(htmlBody).toContain('</html>')
    })
  })
})
