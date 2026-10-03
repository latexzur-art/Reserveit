import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))

const PAYMENT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

// mockRpc/mockSupabase must be created inside vi.hoisted() — vi.mock factories
// are hoisted above regular const declarations, so referencing plain top-level
// consts inside the '@/lib/supabase/server' factory below would TDZ-crash.
const { mockRpc, mockSupabase, mockSendPaymentCompletionNotifications } = vi.hoisted(() => {
  const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null })
  const mockSendPaymentCompletionNotifications = vi.fn().mockResolvedValue(undefined)
  const mockSupabase: any = {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', payment_status: 'pending_review' }, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    rpc: mockRpc,
  }
  return { mockRpc, mockSupabase, mockSendPaymentCompletionNotifications }
})
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))
vi.mock('@/backend/booking/paymentNotifier', () => ({ sendPaymentCompletionNotifications: mockSendPaymentCompletionNotifications }))

import { POST } from '@/app/api/admin/building/payments/[id]/qr-verify/route'

function defaultFrom() {
  return {
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: PAYMENT_ID, payment_status: 'pending_review' }, error: null }) }) }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
  }
}

describe('POST /api/admin/building/payments/[id]/qr-verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockSendPaymentCompletionNotifications.mockResolvedValue(undefined)
    // Reset mockSupabase.from to the pending_review default before each test —
    // the "rejects" test below overrides it, and vi.clearAllMocks() does not
    // undo a plain property reassignment (it only clears vi.fn() call state).
    mockSupabase.from = defaultFrom
  })

  it('rejects a payment that is not pending_review', async () => {
    mockSupabase.from = () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: PAYMENT_ID, payment_status: 'completed' }, error: null }) }) }) })
    const req = new NextRequest('http://x', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(400)
  })

  it('completes the payment via the complete_payment RPC', async () => {
    const req = new NextRequest('http://x', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('complete_payment', expect.objectContaining({ p_payment_id: PAYMENT_ID }))
  })

  it('still returns success when the post-verify completion notification throws after the RPC already committed', async () => {
    mockSendPaymentCompletionNotifications.mockRejectedValueOnce(new Error('network blip'))
    const req = new NextRequest('http://x', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('complete_payment', expect.objectContaining({ p_payment_id: PAYMENT_ID }))
  })
})
