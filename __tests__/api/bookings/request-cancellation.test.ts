import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFacultyUser, mockAuthGuard } from '../../mocks/auth'
import { requireAuthenticatedUser } from '@/lib/auth/guards'

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

describe('POST /api/bookings/[id]/request-cancellation', () => {
  let POST: any

  beforeEach(async () => {
    vi.clearAllMocks()
    for (const method of chainMethods) {
      mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
    }
    mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    queryResult = { data: null, error: null }

    // Dynamic import so mocks are applied first
    const mod = await import('@/app/api/bookings/[id]/request-cancellation/route')
    POST = mod.POST
  })

  it('should require authentication', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(requireAuthenticatedUser).mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null as any,
    })

    const res = await POST(makeRequest({ reason: 'I no longer need this room for my class' }), mockParams)
    expect(res.status).toBe(401)
  })

  it('should require a reason with minimum 20 characters', async () => {
    const res = await POST(makeRequest({ reason: 'Too short' }), mockParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('20')
  })

  it('should return 404 if booking not found', async () => {
    // booking query returns null
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

    const res = await POST(makeRequest({ reason: 'I no longer need this room for my class' }), mockParams)
    expect(res.status).toBe(404)
  })

  it('should return 403 if user is not the booking owner', async () => {
    // booking query returns a booking owned by someone else
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: 'other-user', current_status: 'approved' },
      error: null,
    })

    const res = await POST(makeRequest({ reason: 'I no longer need this room for my class' }), mockParams)
    expect(res.status).toBe(403)
  })

  it('should return 400 if booking is not in cancellable status', async () => {
    // booking query returns a completed booking
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: mockFacultyUser.id, current_status: 'completed' },
      error: null,
    })

    const res = await POST(makeRequest({ reason: 'I no longer need this room for my class' }), mockParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('status')
  })

  it('should return 409 if there is already a pending request', async () => {
    // booking query returns valid booking
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'booking-1', user_id: mockFacultyUser.id, current_status: 'approved' },
      error: null,
    })
    // existing pending request check returns a row
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-request' },
      error: null,
    })

    const res = await POST(makeRequest({ reason: 'I no longer need this room for my class' }), mockParams)
    expect(res.status).toBe(409)
  })

  it('should create cancellation request and update booking status', async () => {
    // booking query returns valid booking
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: mockFacultyUser.id, current_status: 'approved', booking_reference: 'BK-001' },
      error: null,
    })
    // no existing pending request
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    // insert cancellation request
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'req-1' },
      error: null,
    })
    // update booking status
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ reason: 'I no longer need this room for my class' }), mockParams)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.request_id).toBe('req-1')
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ refund_window_met: false })
    )
  })

  it('should reject when the booking has a completed payment and refund destination fields are missing', async () => {
    // booking query returns valid booking
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: mockFacultyUser.id, current_status: 'approved', booking_reference: 'BK-001', booking_date: '2026-08-20' },
      error: null,
    })
    // no existing pending request
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    // completed payment exists
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'pay-1', payment_status: 'completed' }, error: null })

    const res = await POST(makeRequest({ reason: 'I no longer need this room for my class' }), mockParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/destination/i)
  })

  it('should create the request with refund_window_met true when paid and the booking date is well outside the window', async () => {
    // booking query returns valid booking, far enough in the future to clear the 2-whole-day refund window
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: mockFacultyUser.id, current_status: 'approved', booking_reference: 'BK-001', booking_date: '2099-01-10' },
      error: null,
    })
    // no existing pending request
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    // completed payment exists
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'pay-1', payment_status: 'completed' }, error: null })
    // insert cancellation request
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'req-2' },
      error: null,
    })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(
      makeRequest({
        reason: 'I no longer need this room for my class',
        refund_destination_name: 'Jane Doe',
        refund_destination_contact_number: '09171234567',
      }),
      mockParams
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.request_id).toBe('req-2')
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        refund_window_met: true,
        refund_destination_name: 'Jane Doe',
        refund_destination_contact_number: '09171234567',
      })
    )
  })

  it('should detect any non-cancelled payment (not just completed) for routing', async () => {
    const { sendNotificationToRoles } = await import('@/backend/booking/autoDecisionRouter')

    // booking query returns valid booking
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: mockFacultyUser.id, current_status: 'approved', booking_reference: 'BK-001', booking_date: '2026-08-20' },
      error: null,
    })
    // no existing pending request
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    // payment with pending_review status — should be detected as a payment
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'pay-pr', payment_status: 'pending_review' }, error: null })
    // insert cancellation request
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'req-pr' },
      error: null,
    })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(
      makeRequest({
        reason: 'I no longer need this room for my class',
        refund_destination_name: 'Jane Doe',
        refund_destination_contact_number: '09171234567',
      }),
      mockParams
    )
    expect(res.status).toBe(201)

    // Verify the payment query uses .not() to exclude cancelled/failed (the fix),
    // not .eq('payment_status', 'completed') (the bug)
    expect(mockSupabase.not).toHaveBeenCalledWith('payment_status', 'in', '(cancelled,failed)')

    // Must route to building_admin for paid bookings
    expect(sendNotificationToRoles).toHaveBeenCalledWith(
      expect.anything(),
      ['building_admin'],
      expect.objectContaining({
        title: expect.stringContaining('Paid'),
      })
    )
  })

  it('should NOT require refund destination when payment exists but is not completed', async () => {
    // booking query returns valid booking
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: mockFacultyUser.id, current_status: 'approved', booking_reference: 'BK-001', booking_date: '2026-08-20' },
      error: null,
    })
    // no existing pending request
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    // payment with pending status — not completed, so refund destination should not be required
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'pay-pending', payment_status: 'pending' }, error: null })
    // insert cancellation request
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'req-p' },
      error: null,
    })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(
      makeRequest({ reason: 'I no longer need this room for my class' }),
      mockParams
    )
    // Should succeed without refund destination fields since payment is only pending
    expect(res.status).toBe(201)

    // refund_window_met should be false since payment is not completed
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ refund_window_met: false })
    )
  })

  it('should create the request with refund_window_met false when paid but the booking date is inside the window', async () => {
    // booking_date only 1 day out — inside the refund window (needs >=2 whole days)
    const bookingDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, user_id: mockFacultyUser.id, current_status: 'approved', booking_reference: 'BK-001', booking_date: bookingDate },
      error: null,
    })
    // no existing pending request
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    // completed payment exists
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'pay-1', payment_status: 'completed' }, error: null })
    // insert cancellation request
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'req-3' },
      error: null,
    })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(
      makeRequest({
        reason: 'I no longer need this room for my class',
        refund_destination_name: 'Jane Doe',
        refund_destination_contact_number: '09171234567',
      }),
      mockParams
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.request_id).toBe('req-3')
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        refund_window_met: false,
        refund_destination_name: 'Jane Doe',
        refund_destination_contact_number: '09171234567',
      })
    )
  })
})

describe('DELETE /api/bookings/[id]/request-cancellation', () => {
  let DELETE: any

  beforeEach(async () => {
    vi.clearAllMocks()
    for (const method of chainMethods) {
      mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
    }
    mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    queryResult = { data: null, error: null }

    // Dynamic import so mocks are applied first
    const mod = await import('@/app/api/bookings/[id]/request-cancellation/route')
    DELETE = mod.DELETE
  })

  it('should require authentication', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(requireAuthenticatedUser).mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null as any,
    })

    const req = new Request(`http://localhost:3000/api/bookings/${BOOKING_UUID}/request-cancellation`, {
      method: 'DELETE',
    })
    const res = await DELETE(req, mockParams)
    expect(res.status).toBe(401)
  })

  it('should return 404 if no pending cancellation request exists', async () => {
    // maybeSingle returns null (no pending request found)
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const req = new Request(`http://localhost:3000/api/bookings/${BOOKING_UUID}/request-cancellation`, {
      method: 'DELETE',
    })
    const res = await DELETE(req, mockParams)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('pending cancellation request')
  })

  it('should return 403 if the pending request belongs to a different user', async () => {
    // maybeSingle returns a request owned by a different user
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: 'cr-1', user_id: 'other-user-id', original_status: 'approved' },
      error: null,
    })

    const req = new Request(`http://localhost:3000/api/bookings/${BOOKING_UUID}/request-cancellation`, {
      method: 'DELETE',
    })
    const res = await DELETE(req, mockParams)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('should successfully withdraw a pending cancellation request', async () => {
    // maybeSingle returns a pending request owned by the caller
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: 'cr-1', user_id: mockFacultyUser.id, original_status: 'approved' },
      error: null,
    })
    // rpc call to revert booking status
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })
    // Set thenable result for the update chain
    queryResult = { data: null, error: null }

    const req = new Request(`http://localhost:3000/api/bookings/${BOOKING_UUID}/request-cancellation`, {
      method: 'DELETE',
    })
    const res = await DELETE(req, mockParams)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    // Verify the rpc was called to revert the booking status
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'update_booking_status',
      expect.objectContaining({
        p_booking_id: BOOKING_UUID,
        p_new_status: 'approved',
        p_changed_by_user_id: mockFacultyUser.id,
        p_changed_by_ai: false,
      })
    )
  })

  it('should handle invalid booking id format', async () => {
    const invalidParams = { params: Promise.resolve({ id: 'not-a-uuid' }) }
    const req = new Request('http://localhost:3000/api/bookings/not-a-uuid/request-cancellation', {
      method: 'DELETE',
    })
    const res = await DELETE(req, invalidParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid booking id')
  })
})
