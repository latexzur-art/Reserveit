import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  bookerPaymentConfirmedEmail,
  bookerRefundProofEmail,
} from '@/backend/notifications/templates/payments'

describe('receipt notification links', () => {
  // ── Fix 1: Payment confirmation email includes receipt link ───────────────

  describe('bookerPaymentConfirmedEmail', () => {
    const base = {
      userName: 'Juan dela Cruz',
      bookingRef: 'BK-2026-001',
      facilityName: 'Gymnasium',
      bookingDate: 'Monday, April 13, 2026',
      startTime: '8:00 AM',
      endTime: '10:00 AM',
      amountPaid: '₱500.00',
    }

    it('includes a View Receipt button when receiptUrl is provided', () => {
      const receiptUrl = 'https://app.reserveit.ph/client/payment'
      const { htmlBody } = bookerPaymentConfirmedEmail({ ...base, receiptUrl })
      expect(htmlBody).toContain('View Receipt')
      expect(htmlBody).toContain(receiptUrl)
    })

    it('does not include a receipt button when receiptUrl is omitted', () => {
      const { htmlBody } = bookerPaymentConfirmedEmail(base)
      expect(htmlBody).not.toContain('View Receipt')
    })

    it('renders the receipt link as a styled action button', () => {
      const receiptUrl = 'https://app.reserveit.ph/faculty/payment'
      const { htmlBody } = bookerPaymentConfirmedEmail({ ...base, receiptUrl })
      expect(htmlBody).toContain(`<a href="${receiptUrl}"`)
      expect(htmlBody).toContain('View Receipt')
    })
  })

  // ── Fix 2: Refund proof email includes refund receipt link ───────────────

  describe('bookerRefundProofEmail', () => {
    const base = {
      userName: 'Maria Santos',
      bookingRef: 'BK-2026-002',
      amount: '₱1,200.00',
      referenceNumber: 'REF-12345',
    }

    it('includes a View Refund Receipt button when receiptUrl is provided', () => {
      const receiptUrl = 'https://app.reserveit.ph/client/payment'
      const { htmlBody } = bookerRefundProofEmail({ ...base, receiptUrl })
      expect(htmlBody).toContain('View Refund Receipt')
      expect(htmlBody).toContain(receiptUrl)
    })

    it('does not include a receipt button when receiptUrl is omitted', () => {
      const { htmlBody } = bookerRefundProofEmail(base)
      expect(htmlBody).not.toContain('View Refund Receipt')
    })

    it('renders the refund receipt link as a styled action button', () => {
      const receiptUrl = 'https://app.reserveit.ph/program/payment'
      const { htmlBody } = bookerRefundProofEmail({ ...base, receiptUrl })
      expect(htmlBody).toContain(`<a href="${receiptUrl}"`)
      expect(htmlBody).toContain('View Refund Receipt')
    })
  })

  // ── Fix 3: Role-aware receipt URLs ───────────────────────────────────────

  describe('role-aware receipt URLs', () => {
    it('client role uses /client/payment path', () => {
      const { htmlBody } = bookerPaymentConfirmedEmail({
        userName: 'Test',
        bookingRef: 'BK-1',
        facilityName: 'Gym',
        bookingDate: 'Jan 1',
        startTime: '8:00 AM',
        endTime: '10:00 AM',
        amountPaid: '₱100.00',
        receiptUrl: 'https://app.reserveit.ph/client/payment',
      })
      expect(htmlBody).toContain('/client/payment')
    })

    it('faculty role uses /faculty/payment path', () => {
      const { htmlBody } = bookerPaymentConfirmedEmail({
        userName: 'Test',
        bookingRef: 'BK-1',
        facilityName: 'Gym',
        bookingDate: 'Jan 1',
        startTime: '8:00 AM',
        endTime: '10:00 AM',
        amountPaid: '₱100.00',
        receiptUrl: 'https://app.reserveit.ph/faculty/payment',
      })
      expect(htmlBody).toContain('/faculty/payment')
    })

    it('program role uses /program/payment path', () => {
      const { htmlBody } = bookerRefundProofEmail({
        userName: 'Test',
        bookingRef: 'BK-1',
        amount: '₱100.00',
        referenceNumber: 'REF-1',
        receiptUrl: 'https://app.reserveit.ph/program/payment',
      })
      expect(htmlBody).toContain('/program/payment')
    })
  })
})

// ── Fix 4: In-app notification action_url ──────────────────────────────────

describe('in-app payment notification action_url', () => {
  it('sendPaymentCompletionNotifications inserts notification with action_url', async () => {
    // Mock supabase chain
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'pay-1',
        amount: 500,
        currency: 'PHP',
        booking: {
          id: 'bk-1',
          booking_reference: 'BK-2026-001',
          booking_date: '2026-04-13',
          start_time: '08:00:00',
          end_time: '10:00:00',
          user_id: 'user-1',
          booking_facilities: [{ facility_id: 'fac-1', facility: { name: 'Gymnasium' } }],
          user: { full_name: 'Juan dela Cruz', email: 'juan@test.com', notification_email: 'juan@test.com' },
        },
      },
      error: null,
    })
    const mockEq = vi.fn(() => ({ single: mockSingle }))
    const mockSelect = vi.fn(() => ({ eq: mockEq }))
    const mockFrom = vi.fn((table: string) => {
      if (table === 'payments') return { select: mockSelect }
      if (table === 'notifications') return { insert: vi.fn().mockResolvedValue({ error: null }) }
      if (table === 'bookings') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { booking_reference: 'BK-2026-001' } }) }) }) }
      if (table === 'user_roles') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [{ roles: { name: 'client' } }] }) }) }) }) }
      return { select: vi.fn() }
    })

    // Track the notification insert call
    let insertedNotification: any = null
    mockFrom.mockImplementation((table: string) => {
      if (table === 'payments') return { select: mockSelect }
      if (table === 'notifications') {
        return {
          insert: vi.fn((payload: any) => {
            insertedNotification = payload
            return { error: null }
          }),
        }
      }
      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [{ roles: { name: 'client' } }] }),
              }),
            }),
          }),
        }
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {} }) }) }) }
    })

    const mockSupabase = { from: mockFrom } as any

    // Mock the imports
    vi.mock('@/backend/booking/autoDecisionRouter', () => ({
      sendNotificationToRoles: vi.fn().mockResolvedValue(undefined),
    }))
    vi.mock('@/backend/notifications/recipientResolver', () => ({
      getBuildingAdminEmails: vi.fn().mockResolvedValue([]),
      resolveUserPageUrls: vi.fn().mockResolvedValue({
        bookingsUrl: '/client/bookings',
        paymentUrl: '/client/payment',
      }),
    }))
    vi.mock('@/backend/notifications/brevoEmailService', () => ({
      sendBrevoEmail: vi.fn().mockResolvedValue(undefined),
    }))
    vi.mock('@/backend/schedule-events/voidScheduleConflictsForPaidBooking', () => ({
      voidScheduleConflictsForPaidBooking: vi.fn().mockResolvedValue(undefined),
    }))

    // Set env
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.reserveit.ph'

    const { sendPaymentCompletionNotifications } = await import('@/backend/booking/paymentNotifier')
    await sendPaymentCompletionNotifications(mockSupabase, 'pay-1')

    // Verify the notification was inserted with action_url
    expect(insertedNotification).not.toBeNull()
    expect(insertedNotification.user_id).toBe('user-1')
    expect(insertedNotification.action_url).toBe('https://app.reserveit.ph/client/payment')
    expect(insertedNotification.title).toBe('Payment Confirmed')
  })
})
