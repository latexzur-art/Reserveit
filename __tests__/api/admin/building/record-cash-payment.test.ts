import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))

const BOOKING_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

const { mockAuditLog, mockSupabase, mockSendNotification } = vi.hoisted(() => {
  const mockAuditLog = vi.fn().mockResolvedValue(undefined)
  const mockSendNotification = vi.fn().mockResolvedValue(undefined)
  const mockSupabase: any = {}
  return { mockAuditLog, mockSupabase, mockSendNotification }
})

vi.mock('@/backend/admin/admin-audit.service', () => ({ AdminAuditService: { log: mockAuditLog } }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))
vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: mockSendNotification,
  sendNotificationToRoles: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/backend/notifications/recipientResolver', () => ({ resolveUserEmail: vi.fn().mockResolvedValue({ emailTo: null, name: null }) }))
vi.mock('@/backend/notifications/brevoEmailService', () => ({ sendBrevoEmail: vi.fn() }))

import { POST } from '@/app/api/admin/building/bookings/[id]/record-cash-payment/route'

function approvedBookingFrom() {
  return {
    select: () => ({
      eq: () => ({
        single: () =>
          Promise.resolve({
            data: {
              id: BOOKING_ID,
              current_status: 'approved',
              user_id: 'user-001',
              booking_reference: 'BK-2026-0001',
            },
            error: null,
          }),
      }),
    }),
  }
}

describe('POST /api/admin/building/bookings/[id]/record-cash-payment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from = approvedBookingFrom
  })

  it('returns 400 for invalid booking id', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'not-a-uuid' }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 when amount is missing or non-positive', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_ID }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 when amount is zero or negative', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ amount: 0 }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_ID }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when booking does not exist', async () => {
    mockSupabase.from = () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
        }),
      }),
    })
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_ID }) })
    expect(res.status).toBe(404)
  })

  it('returns 409 when booking is not in an approved status', async () => {
    mockSupabase.from = () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: BOOKING_ID,
                current_status: 'pending',
                user_id: 'user-001',
                booking_reference: 'BK-2026-0001',
              },
              error: null,
            }),
        }),
      }),
    })
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_ID }) })
    expect(res.status).toBe(409)
  })

  it('creates a cashier payment with completed status and returns 201', async () => {
    let insertedPayment: any = null
    mockSupabase.from = (table: string) => {
      if (table === 'bookings') return approvedBookingFrom()
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
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    }

    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ amount: 500, receipt_number: 'RCP-001', notes: 'Walk-in payment' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_ID }) })

    expect(res.status).toBe(201)
    expect(insertedPayment).toBeTruthy()
    expect(insertedPayment.booking_id).toBe(BOOKING_ID)
    expect(insertedPayment.user_id).toBe('user-001')
    expect(insertedPayment.amount).toBe(500)
    expect(insertedPayment.currency).toBe('PHP')
    expect(insertedPayment.payment_method).toBe('cashier')
    expect(insertedPayment.payment_status).toBe('completed')
    expect(insertedPayment.payment_type).toBe('booking')
  })

  it('logs to AdminAuditService on success', async () => {
    mockSupabase.from = (table: string) => {
      if (table === 'bookings') return approvedBookingFrom()
      if (table === 'payments') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'pay-001' }, error: null }),
            }),
          }),
        }
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    }

    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_ID }) })
    expect(res.status).toBe(201)
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cash_payment_recorded',
        targetType: 'booking',
        targetId: BOOKING_ID,
      }),
    )
  })

  it('sends notification to user on successful payment', async () => {
    mockSupabase.from = (table: string) => {
      if (table === 'bookings') return approvedBookingFrom()
      if (table === 'payments') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'pay-001' }, error: null }),
            }),
          }),
        }
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    }

    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    })
    await POST(req, { params: Promise.resolve({ id: BOOKING_ID }) })
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        user_id: 'user-001',
        title: expect.stringContaining('Payment'),
      }),
    )
  })

  it('includes receipt_number and notes in payment metadata when provided', async () => {
    let insertedPayment: any = null
    mockSupabase.from = (table: string) => {
      if (table === 'bookings') return approvedBookingFrom()
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
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    }

    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ amount: 500, receipt_number: 'RCP-123', notes: 'Special event' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_ID }) })
    expect(res.status).toBe(201)
    expect(insertedPayment.metadata.receipt_number).toBe('RCP-123')
    expect(insertedPayment.metadata.notes).toBe('Special event')
  })

  it('returns 500 when payment insert fails', async () => {
    mockSupabase.from = (table: string) => {
      if (table === 'bookings') return approvedBookingFrom()
      if (table === 'payments') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { message: 'db error' } }),
            }),
          }),
        }
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    }

    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_ID }) })
    expect(res.status).toBe(500)
  })
})
