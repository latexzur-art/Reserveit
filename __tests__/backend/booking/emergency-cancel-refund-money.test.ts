import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  sendNotificationToRoles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/backend/notifications/recipientResolver', () => ({
  getBuildingAdminEmails: vi.fn().mockResolvedValue(['admin@example.com']),
  resolveUserEmail: vi.fn().mockResolvedValue({ emailTo: 'user@example.com', name: 'Test User' }),
}))

vi.mock('@/backend/credits/creditService', () => ({
  creditService: {
    issueCredit: vi.fn().mockResolvedValue({ creditId: 'c1', newBalance: 100 }),
  },
}))

import { cancelWithRefund } from '@/backend/booking/emergencyReschedule.holdRefund'
import { respondToEmergencyReschedule } from '@/backend/booking/emergencyReschedule.respond'
import { creditService } from '@/backend/credits/creditService'
import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'

describe('cancelWithRefund — actual money refund path', () => {
  let mockSupabase: any
  let paymentsUpdateCalls: any[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    paymentsUpdateCalls = []

    const paymentsChain: any = {
      select: vi.fn(() => paymentsChain),
      eq: vi.fn(() => paymentsChain),
      in: vi.fn(() => paymentsChain),
      update: vi.fn((data: any) => {
        paymentsUpdateCalls.push(data)
        return paymentsChain
      }),
      then: (resolve: any) => Promise.resolve({
        data: [{ id: 'pay-1', amount: 1500, payment_status: 'completed' }],
        error: null,
      }).then(resolve),
    }

    const bookingsChain: any = {
      select: vi.fn(() => bookingsChain),
      eq: vi.fn(() => bookingsChain),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'booking-1',
          user_id: 'user-1',
          booking_reference: 'BK-001',
          current_status: 'approved',
          booking_date: '2026-08-20',
          start_time: '08:00',
          end_time: '12:00',
          booking_facilities: [{ facility_id: 'f1', facilities: { name: 'Gymnasium' } }],
        },
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
      then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
    }

    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'payments') return paymentsChain
        if (table === 'bookings') return bookingsChain
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
        }
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

  it('marks completed payments as refund_requested and does NOT call creditService.issueCredit', async () => {
    const result = await cancelWithRefund(mockSupabase, {
      bookingId: 'booking-1',
      adminUserId: 'admin-1',
      refundReason: 'Roof maintenance',
    })

    expect(result.success).toBe(true)
    expect(result.message).toContain('refund of ₱1500.00 has been requested')
    expect(creditService.issueCredit).not.toHaveBeenCalled()
    expect(paymentsUpdateCalls).toContainEqual(expect.objectContaining({
      payment_status: 'refund_requested',
    }))
    expect(sendNotificationToRoles).toHaveBeenCalledWith(
      mockSupabase,
      ['building_admin'],
      expect.objectContaining({
        title: 'Refund Owed — Emergency Cancellation',
        type: 'warning',
        priority: 'high',
      })
    )
  })
})

describe('respondToEmergencyReschedule (decline) — actual money refund path', () => {
  let mockSupabase: any
  let paymentsUpdateCalls: any[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    paymentsUpdateCalls = []

    const paymentsChain: any = {
      select: vi.fn(() => paymentsChain),
      eq: vi.fn(() => paymentsChain),
      in: vi.fn(() => paymentsChain),
      update: vi.fn((data: any) => {
        paymentsUpdateCalls.push(data)
        return paymentsChain
      }),
      then: (resolve: any) => Promise.resolve({
        data: [{ id: 'pay-2', amount: 2000, payment_status: 'completed' }],
        error: null,
      }).then(resolve),
    }

    const bookingsChain: any = {
      select: vi.fn(() => bookingsChain),
      eq: vi.fn(() => bookingsChain),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'booking-2',
          user_id: 'user-2',
          booking_reference: 'BK-002',
          current_status: 'pending_user_response',
          booking_date: '2026-08-22',
          start_time: '13:00',
          end_time: '17:00',
          metadata: {},
          booking_facilities: [{ facility_id: 'f2', facilities: { name: 'Auditorium' } }],
        },
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
      then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
    }

    const overridesChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'override-1',
          new_values: { booking_date: '2026-08-25', start_time: '13:00', end_time: '17:00' },
        },
        error: null,
      }),
    }

    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'payments') return paymentsChain
        if (table === 'bookings') return bookingsChain
        if (table === 'booking_overrides') return overridesChain
        if (table === 'system_settings') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
        }
      }),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    }
  })

  it('marks completed payments as refund_requested on decline and does NOT call creditService.issueCredit', async () => {
    const result = await respondToEmergencyReschedule(mockSupabase, {
      bookingId: 'booking-2',
      userId: 'user-2',
      action: 'decline_convert_to_credit',
    })

    expect(result.success).toBe(true)
    expect(result.message).toContain('refund of ₱2000.00 has been requested')
    expect(creditService.issueCredit).not.toHaveBeenCalled()
    expect(paymentsUpdateCalls).toContainEqual(expect.objectContaining({
      payment_status: 'refund_requested',
    }))
    expect(sendNotificationToRoles).toHaveBeenCalledWith(
      mockSupabase,
      ['building_admin'],
      expect.objectContaining({
        title: 'User Declined Reschedule — Refund Owed',
        type: 'warning',
        priority: 'high',
      })
    )
  })
})
