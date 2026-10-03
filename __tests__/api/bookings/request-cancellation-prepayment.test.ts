import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFacultyUser, mockAuthGuard } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))

// Mock Supabase with chainable + thenable pattern
let queryResult: any = { data: null, error: null }
const mockSupabase: any = {}
const chainMethods = ['from', 'select', 'eq', 'in', 'not', 'single', 'update', 'insert', 'maybeSingle'] as const
for (const method of chainMethods) {
  mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
}
mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null })

mockSupabase.then = function (resolve: any, reject?: any) {
  return Promise.resolve(queryResult).then(resolve, reject)
}

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockSupabase,
}))

vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  sendNotificationToRoles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/errors', () => ({
  getErrorMessage: (err: any) => err?.message ?? 'Unknown error',
  getErrorDetails: (err: any) => err?.message ?? 'Unknown error',
}))

function makeRequest(body?: any) {
  const init: any = { method: 'POST' }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new Request(`http://localhost:3000/api/bookings/${BOOKING_UUID}/request-cancellation`, init)
}

const BOOKING_UUID = 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const mockParams = { params: Promise.resolve({ id: BOOKING_UUID }) }

describe('POST /api/bookings/[id]/request-cancellation — pending_user_response', () => {
  let POST: any

  beforeEach(async () => {
    vi.clearAllMocks()
    for (const method of chainMethods) {
      mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
    }
    mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    queryResult = { data: null, error: null }

    const mod = await import('@/app/api/bookings/[id]/request-cancellation/route')
    POST = mod.POST
  })

  it('allows cancellation request from pending_user_response status', async () => {
    // booking query returns valid booking in pending_user_response
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: mockFacultyUser.id, current_status: 'pending_user_response', booking_reference: 'BK-001', booking_date: '2026-08-20' },
      error: null,
    })
    // no existing pending request
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    // no completed payment
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    // insert cancellation request
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'req-1' },
      error: null,
    })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ reason: 'I can no longer afford the payment for this booking' }), mockParams)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('requires refund destination when pending_user_response booking has a completed payment', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: mockFacultyUser.id, current_status: 'pending_user_response', booking_reference: 'BK-001', booking_date: '2026-08-20' },
      error: null,
    })
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    // completed payment exists
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'pay-1', payment_status: 'completed' }, error: null })

    const res = await POST(makeRequest({ reason: 'I can no longer afford the payment' }), mockParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/destination/i)
  })

  it('rejects cancellation request from completed status', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: mockFacultyUser.id, current_status: 'completed', booking_reference: 'BK-001' },
      error: null,
    })

    const res = await POST(makeRequest({ reason: 'I want to cancel this completed booking for testing' }), mockParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('status')
  })

  it('rejects cancellation request from cancelled status', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: mockFacultyUser.id, current_status: 'cancelled', booking_reference: 'BK-001' },
      error: null,
    })

    const res = await POST(makeRequest({ reason: 'I want to cancel this already cancelled booking' }), mockParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('status')
  })

  it('rejects if a pending cancellation request already exists', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: mockFacultyUser.id, current_status: 'pending_user_response', booking_reference: 'BK-001', booking_date: '2026-08-20' },
      error: null,
    })
    // existing pending request
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'existing-req' }, error: null })

    const res = await POST(makeRequest({ reason: 'I already requested cancellation once before' }), mockParams)
    expect(res.status).toBe(409)
  })
})
