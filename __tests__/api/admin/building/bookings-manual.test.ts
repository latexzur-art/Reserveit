import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))

const { mockSupabase, mockSendNotification, mockCalculateAmount } = vi.hoisted(() => {
  const mockSendNotification = vi.fn().mockResolvedValue(undefined)
  const mockCalculateAmount = vi.fn().mockResolvedValue({ amount: 350, breakdown: [], rateConfig: undefined })
  const mockSupabase: any = {}
  return { mockSupabase, mockSendNotification, mockCalculateAmount }
})

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))
vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: mockSendNotification,
  sendNotificationToRoles: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/backend/booking/paymentService', () => ({
  BookingPaymentService: { calculateAmount: mockCalculateAmount },
}))
vi.mock('@/backend/notifications/recipientResolver', () => ({ resolveUserEmail: vi.fn().mockResolvedValue({ emailTo: null, name: null }) }))
vi.mock('@/backend/notifications/brevoEmailService', () => ({ sendBrevoEmail: vi.fn() }))

import { POST } from '@/app/api/admin/building/bookings/manual/route'

const VALID_BODY = {
  userId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  bookingType: 'internal',
  bookingPurpose: 'class',
  bookingDate: '2026-08-20',
  startTime: '08:00',
  endTime: '10:00',
  purpose: 'Physics class',
  facilityIds: ['b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'],
}

function baseMockFrom() {
  return {
    insert: (data: any) => ({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { id: 'booking-new-001', booking_reference: 'BK-2026-9999', user_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', ...data },
            error: null,
          }),
      }),
    }),
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: { value: 'paymongo' }, error: null }),
      }),
    }),
  }
}

describe('POST /api/admin/building/bookings/manual', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from = baseMockFrom
  })

  it('creates a booking without payment when no payment fields provided', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockCalculateAmount).not.toHaveBeenCalled()
  })

  it('creates a booking with a pending cashier payment when payment_amount is provided', async () => {
    let insertedPayment: any = null
    mockSupabase.from = (table: string) => {
      if (table === 'payments') {
        return {
          insert: (data: any) => {
            insertedPayment = data
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'pay-001', ...data }, error: null }),
              }),
            }
          },
        }
      }
      return baseMockFrom()
    }

    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({
        ...VALID_BODY,
        paymentAmount: 350,
        paymentMethod: 'cashier',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(insertedPayment).toBeTruthy()
    expect(insertedPayment.amount).toBe(350)
    expect(insertedPayment.payment_method).toBe('cashier')
    expect(insertedPayment.payment_status).toBe('completed')
    expect(insertedPayment.booking_id).toBe('booking-new-001')
  })

  it('defaults payment_method to cashier when only payment_amount is given', async () => {
    let insertedPayment: any = null
    mockSupabase.from = (table: string) => {
      if (table === 'payments') {
        return {
          insert: (data: any) => {
            insertedPayment = data
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'pay-001', ...data }, error: null }),
              }),
            }
          },
        }
      }
      return baseMockFrom()
    }

    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, paymentAmount: 500 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(insertedPayment.payment_method).toBe('cashier')
    expect(insertedPayment.payment_status).toBe('completed')
  })
})
