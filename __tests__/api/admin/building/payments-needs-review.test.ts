import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))

// mockOrder/mockSupabase must be created inside vi.hoisted() — vi.mock factories
// are hoisted above regular const declarations, so referencing plain top-level
// consts inside the '@/lib/supabase/server' factory below would TDZ-crash.
const { mockIn, mockOrder, mockSupabase } = vi.hoisted(() => {
  const mockOrder = vi.fn().mockResolvedValue({ data: [{ id: 'p-1', payment_reference: 'PAY-1' }], error: null })
  const mockIn = vi.fn(() => ({ order: mockOrder }))
  const mockSupabase: any = {
    from: () => ({ select: () => ({ in: mockIn }) }),
  }
  return { mockIn, mockOrder, mockSupabase }
})
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))

import { GET } from '@/app/api/admin/building/payments/needs-review/route'

describe('GET /api/admin/building/payments/needs-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrder.mockResolvedValue({ data: [{ id: 'p-1', payment_reference: 'PAY-1' }], error: null })
  })

  it('filters payments to pending_review and refund_requested statuses', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(mockIn).toHaveBeenCalledWith('payment_status', ['pending_review', 'refund_requested', 'refund_processing', 'disputed'])
  })

  it('returns the payments array from the response body', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.payments).toEqual([{ id: 'p-1', payment_reference: 'PAY-1' }])
  })

  it('returns 500 when the query errors', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'db exploded' } })
    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('returns an empty array when data is null', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: null })
    const res = await GET()
    const body = await res.json()
    expect(body.payments).toEqual([])
  })
})
