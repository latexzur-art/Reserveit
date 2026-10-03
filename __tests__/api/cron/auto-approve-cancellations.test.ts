import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  sendNotificationToRoles: vi.fn().mockResolvedValue(undefined),
}))

import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a per-table Supabase mock: `from('table')` returns a chainable object
 * scoped to that table, so `payments` and `cancellation_requests` queries can be
 * asserted on independently (they share no state).
 */
function makeChain(defaultResult: { data: any; error: any }, singleResult?: { data: any; error: any }) {
  const chain: any = {}
  for (const method of ['select', 'eq', 'lt'] as const) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }
  chain.update = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(singleResult ?? { data: null, error: null })
  chain.then = (resolve: any, reject?: any) => Promise.resolve(defaultResult).then(resolve, reject)
  return chain
}

function makeSupabaseMock(opts: {
  fetchResult: { data: any; error: any }
  paymentSingleResult?: { data: any; error: any }
}) {
  const cancellationRequestsChain = makeChain(opts.fetchResult)
  const bookingsChain = makeChain({ data: null, error: null })
  const paymentsChain = makeChain({ data: null, error: null }, opts.paymentSingleResult)

  const tableChains: Record<string, any> = {
    cancellation_requests: cancellationRequestsChain,
    bookings: bookingsChain,
    payments: paymentsChain,
  }

  return {
    from: vi.fn((table: string) => tableChains[table] ?? makeChain({ data: null, error: null })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    _chains: tableChains,
  }
}

function makeCronReq(secret: string | null = process.env.CRON_SECRET ?? 'test-cron-secret') {
  const headers: Record<string, string> = secret !== null ? { authorization: `Bearer ${secret}` } : {}
  return new NextRequest('http://localhost/api/cron/auto-approve-cancellations', { headers })
}

describe('GET /api/cron/auto-approve-cancellations', () => {
  let GET: any
  let mockCreateAdminClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    mockCreateAdminClient = vi.fn()
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: mockCreateAdminClient,
    }))

    mockCreateAdminClient.mockReturnValue(makeSupabaseMock({ fetchResult: { data: [], error: null } }))

    const mod = await import('@/app/api/cron/auto-approve-cancellations/route')
    GET = mod.GET
  })

  describe('Authorization', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await GET(makeCronReq(null))
      expect(res.status).toBe(401)
    })

    it('returns 401 when bearer token is wrong', async () => {
      const res = await GET(makeCronReq('wrong-secret'))
      expect(res.status).toBe(401)
    })

    it('returns 200 with the correct token', async () => {
      const res = await GET(makeCronReq())
      expect(res.status).toBe(200)
    })
  })

  it('should return 0 processed when no expired requests', async () => {
    mockCreateAdminClient.mockReturnValue(makeSupabaseMock({ fetchResult: { data: [], error: null } }))

    const res = await GET(makeCronReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.processed).toBe(0)
  })

  it('should auto-approve expired pending requests', async () => {
    const mockRequests = [
      {
        id: 'req-1',
        booking_id: 'booking-1',
        user_id: 'user-1',
        reason: 'Schedule conflict with exam',
        original_status: 'approved',
        refund_window_met: false,
        bookings: { booking_reference: 'BK-001' },
      },
    ]
    mockCreateAdminClient.mockReturnValue(makeSupabaseMock({ fetchResult: { data: mockRequests, error: null } }))

    const res = await GET(makeCronReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.processed).toBe(1)
    expect(body.failed).toBe(0)
  })

  it('should handle fetch errors gracefully', async () => {
    mockCreateAdminClient.mockReturnValue(
      makeSupabaseMock({ fetchResult: { data: null, error: { message: 'DB connection failed' } } })
    )

    const res = await GET(makeCronReq())
    expect(res.status).toBe(500)
  })

  describe('Refund-entitlement hook', () => {
    const mockRequest = {
      id: 'req-1',
      booking_id: 'booking-1',
      user_id: 'user-1',
      reason: 'Schedule conflict with exam',
      original_status: 'approved',
      refund_window_met: true,
      bookings: { booking_reference: 'BK-001' },
    }

    it('marks the completed payment refund_requested and notifies Building Admin when refund_window_met is true and a completed payment exists', async () => {
      const supabaseMock = makeSupabaseMock({
        fetchResult: { data: [mockRequest], error: null },
        paymentSingleResult: { data: { id: 'pay-1', payment_status: 'completed' }, error: null },
      })
      mockCreateAdminClient.mockReturnValue(supabaseMock)

      const res = await GET(makeCronReq())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.processed).toBe(1)
      expect(supabaseMock._chains.payments.update).toHaveBeenCalledWith(
        expect.objectContaining({ payment_status: 'refund_requested' })
      )
      expect(sendNotificationToRoles).toHaveBeenCalledWith(
        supabaseMock,
        ['building_admin'],
        expect.objectContaining({ priority: 'high', type: 'warning' })
      )
    })

    it('does not touch payments or notify Building Admin when refund_window_met is false', async () => {
      const supabaseMock = makeSupabaseMock({
        fetchResult: { data: [{ ...mockRequest, refund_window_met: false }], error: null },
        paymentSingleResult: { data: { id: 'pay-1', payment_status: 'completed' }, error: null },
      })
      mockCreateAdminClient.mockReturnValue(supabaseMock)

      const res = await GET(makeCronReq())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.processed).toBe(1)
      expect(supabaseMock._chains.payments.update).not.toHaveBeenCalled()
      expect(sendNotificationToRoles).not.toHaveBeenCalled()
    })

    it('does not notify Building Admin when refund_window_met is true but no completed payment exists', async () => {
      const supabaseMock = makeSupabaseMock({
        fetchResult: { data: [mockRequest], error: null },
        paymentSingleResult: { data: null, error: null },
      })
      mockCreateAdminClient.mockReturnValue(supabaseMock)

      const res = await GET(makeCronReq())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.processed).toBe(1)
      expect(supabaseMock._chains.payments.update).not.toHaveBeenCalled()
      expect(sendNotificationToRoles).not.toHaveBeenCalled()
    })

    it('still sends the user auto-approval notification alongside the refund hook', async () => {
      const supabaseMock = makeSupabaseMock({
        fetchResult: { data: [mockRequest], error: null },
        paymentSingleResult: { data: { id: 'pay-1', payment_status: 'completed' }, error: null },
      })
      mockCreateAdminClient.mockReturnValue(supabaseMock)

      await GET(makeCronReq())

      expect(sendNotification).toHaveBeenCalledWith(
        supabaseMock,
        expect.objectContaining({ user_id: 'user-1', title: 'Cancellation Auto-Approved' })
      )
    })
  })
})
