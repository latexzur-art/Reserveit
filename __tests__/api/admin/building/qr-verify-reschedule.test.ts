import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))

const PAYMENT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

const {
  mockRpc,
  mockSupabase,
  mockSendPaymentCompletionNotifications,
  mockApplyRescheduleOnPayment,
} = vi.hoisted(() => {
  const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null })
  const mockSendPaymentCompletionNotifications = vi.fn().mockResolvedValue(undefined)
  const mockApplyRescheduleOnPayment = vi.fn().mockResolvedValue({ applied: true, message: 'ok' })
  const mockSupabase: any = {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: PAYMENT_ID, payment_status: 'pending_review' }, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    rpc: mockRpc,
  }
  return { mockRpc, mockSupabase, mockSendPaymentCompletionNotifications, mockApplyRescheduleOnPayment }
})

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))
vi.mock('@/backend/booking/paymentNotifier', () => ({ sendPaymentCompletionNotifications: mockSendPaymentCompletionNotifications }))
vi.mock('@/backend/booking/emergencyRescheduleRequestService', () => ({ applyRescheduleOnPayment: mockApplyRescheduleOnPayment }))

import { POST } from '@/app/api/admin/building/payments/[id]/qr-verify/route'

/**
 * Build a from() mock that handles all sequential payments table calls:
 * 1. Initial status check (select)
 * 2. QR reviewed update (update)
 * 3. Payment type lookup after RPC (select)
 */
function buildFrom(paymentType: string | null = null) {
  let callCount = 0
  return (table: string) => {
    if (table === 'payments') {
      callCount++
      if (callCount === 1) {
        // First call: initial select for status check
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: PAYMENT_ID, payment_status: 'pending_review' }, error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }
      if (callCount === 2) {
        // Second call: update qr_reviewed_by / qr_reviewed_at
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { payment_type: paymentType }, error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }
      // Third call: payment_type lookup after RPC
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { payment_type: paymentType }, error: null }) }) }),
      }
    }
    return {
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }
  }
}

describe('POST /api/admin/building/payments/[id]/qr-verify — reschedule_extra', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockSendPaymentCompletionNotifications.mockResolvedValue(undefined)
    mockApplyRescheduleOnPayment.mockResolvedValue({ applied: true, message: 'ok' })
  })

  it('calls applyRescheduleOnPayment when payment_type is reschedule_extra', async () => {
    mockSupabase.from = buildFrom('reschedule_extra')
    const req = new NextRequest('http://x', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })

    expect(res.status).toBe(200)
    expect(mockApplyRescheduleOnPayment).toHaveBeenCalledWith(PAYMENT_ID)
  })

  it('does NOT call sendPaymentCompletionNotifications when payment_type is reschedule_extra', async () => {
    mockSupabase.from = buildFrom('reschedule_extra')
    const req = new NextRequest('http://x', { method: 'POST' })
    await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })

    expect(mockSendPaymentCompletionNotifications).not.toHaveBeenCalled()
  })

  it('still calls sendPaymentCompletionNotifications for non-reschedule_extra payments', async () => {
    mockSupabase.from = buildFrom(null)
    const req = new NextRequest('http://x', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })

    expect(res.status).toBe(200)
    expect(mockSendPaymentCompletionNotifications).toHaveBeenCalledWith(mockSupabase, PAYMENT_ID)
    expect(mockApplyRescheduleOnPayment).not.toHaveBeenCalled()
  })

  it('still returns 200 when applyRescheduleOnPayment fails (logged, not thrown)', async () => {
    mockApplyRescheduleOnPayment.mockResolvedValue({ applied: false, message: 'Not a reschedule_extra payment.' })
    mockSupabase.from = buildFrom('reschedule_extra')
    const req = new NextRequest('http://x', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })

    expect(res.status).toBe(200)
    expect(mockApplyRescheduleOnPayment).toHaveBeenCalledWith(PAYMENT_ID)
  })
})
