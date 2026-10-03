import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  sendNotificationToRoles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/notifications/emailTemplates', () => ({
  rescheduleOfferExpiredEmail: vi.fn().mockReturnValue({ subject: 'Expired', htmlBody: '<p>Expired</p>' }),
}))

import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeChain(defaultResult: { data: any; error: any }, opts?: { singleResult?: { data: any; error: any }; hasInsert?: boolean }) {
  const chain: any = {}
  for (const method of ['select', 'eq', 'lt'] as const) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }
  chain.update = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(opts?.singleResult ?? { data: null, error: null })
  if (opts?.hasInsert) {
    chain.insert = vi.fn().mockResolvedValue({ data: null, error: null })
  }
  chain.then = (resolve: any, reject?: any) => Promise.resolve(defaultResult).then(resolve, reject)
  return chain
}

function makeSupabaseMock(opts: {
  bookingsResult: { data: any; error: any }
  paymentSingleResult?: { data: any; error: any }
}) {
  const bookingsChain = makeChain(opts.bookingsResult)
  const paymentsChain = makeChain({ data: null, error: null }, { singleResult: opts.paymentSingleResult })
  const notificationsChain = makeChain({ data: null, error: null }, { hasInsert: true })
  const usersChain = makeChain({ data: null, error: null })
  const classOffersChain = makeChain({ data: [], error: null })
  const classExceptionsChain = makeChain({ data: null, error: null })

  const tableChains: Record<string, any> = {
    bookings: bookingsChain,
    payments: paymentsChain,
    notifications: notificationsChain,
    users: usersChain,
    class_schedule_reschedule_offers: classOffersChain,
    class_schedule_exceptions: classExceptionsChain,
  }

  return {
    from: vi.fn((table: string) => tableChains[table] ?? makeChain({ data: null, error: null })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    _chains: tableChains,
  }
}

function makeCronReq(secret: string | null = process.env.CRON_SECRET ?? 'test-cron-secret') {
  const headers: Record<string, string> = secret !== null ? { authorization: `Bearer ${secret}` } : {}
  return new NextRequest('http://localhost/api/cron/reschedule-offer-expiry', { headers })
}

const EXPIRED_BOOKING = {
  id: 'booking-exp-1',
  user_id: 'user-1',
  booking_reference: 'BK-RESCHED-001',
  booking_date: '2026-08-20',
  start_time: '09:00:00',
  end_time: '10:00:00',
  original_date: '2026-08-15',
  original_start_time: '09:00',
  original_end_time: '10:00',
}

describe('GET /api/cron/reschedule-offer-expiry — refund hook', () => {
  let GET: any
  let mockCreateAdminClient: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    mockCreateAdminClient = vi.fn()
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: mockCreateAdminClient,
    }))

    mockCreateAdminClient.mockReturnValue(makeSupabaseMock({
      bookingsResult: { data: [], error: null },
    }))

    const mod = await import('@/app/api/cron/reschedule-offer-expiry/route')
    GET = mod.GET
  })

  it('marks completed payment as refund_requested when an expired booking has a completed payment', async () => {
    const supabaseMock = makeSupabaseMock({
      bookingsResult: { data: [EXPIRED_BOOKING], error: null },
      paymentSingleResult: { data: { id: 'pay-1', payment_status: 'completed' }, error: null },
    })
    mockCreateAdminClient.mockReturnValue(supabaseMock)

    const res = await GET(makeCronReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.bookingsCancelled).toBe(1)
    expect(supabaseMock._chains.payments.update).toHaveBeenCalledWith(
      expect.objectContaining({ payment_status: 'refund_requested' })
    )
  })

  it('notifies building admins when a refund is owed', async () => {
    const supabaseMock = makeSupabaseMock({
      bookingsResult: { data: [EXPIRED_BOOKING], error: null },
      paymentSingleResult: { data: { id: 'pay-1', payment_status: 'completed' }, error: null },
    })
    mockCreateAdminClient.mockReturnValue(supabaseMock)

    await GET(makeCronReq())

    expect(sendNotificationToRoles).toHaveBeenCalledWith(
      supabaseMock,
      ['building_admin'],
      expect.objectContaining({
        title: expect.stringContaining('Refund'),
        type: 'warning',
        priority: 'high',
      })
    )
  })

  it('does NOT touch payments or notify when no completed payment exists for the expired booking', async () => {
    const supabaseMock = makeSupabaseMock({
      bookingsResult: { data: [EXPIRED_BOOKING], error: null },
      paymentSingleResult: { data: null, error: null },
    })
    mockCreateAdminClient.mockReturnValue(supabaseMock)

    const res = await GET(makeCronReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.bookingsCancelled).toBe(1)
    expect(supabaseMock._chains.payments.update).not.toHaveBeenCalled()
    expect(sendNotificationToRoles).not.toHaveBeenCalled()
  })

  it('does nothing when there are no expired bookings', async () => {
    const supabaseMock = makeSupabaseMock({
      bookingsResult: { data: [], error: null },
    })
    mockCreateAdminClient.mockReturnValue(supabaseMock)

    const res = await GET(makeCronReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.bookingsCancelled).toBe(0)
    expect(sendNotificationToRoles).not.toHaveBeenCalled()
  })
})
