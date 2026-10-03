import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockFacultyUser, mockBuildingAdminUser, mockAuthGuard } from '../../mocks/auth'

// Mock dependencies
vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))

// Create a chainable + thenable mock that resolves when awaited
let queryResult = { data: [] as any[], count: 0, error: null as any }

const mockSupabase: any = {}
const chainMethods = ['from', 'select', 'eq', 'in', 'gte', 'order', 'range', 'delete', 'update'] as const
for (const method of chainMethods) {
  mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
}
mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null })
mockSupabase.insert = vi.fn().mockReturnValue(mockSupabase)
mockSupabase.single = vi.fn().mockResolvedValue({ data: { id: 'b-new', booking_reference: 'REF-NEW' }, error: null })

// Make the mock thenable so `await query` resolves to queryResult
mockSupabase.then = function (resolve: any, reject?: any) {
  return Promise.resolve(queryResult).then(resolve, reject)
}

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockSupabase,
}))

vi.mock('@/backend/booking', () => ({
  processBooking: vi.fn().mockResolvedValue({ status: 'auto_approved' }),
  getSuggestions: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(null),
  checkRateLimitAsync: vi.fn().mockResolvedValue(null),
  RATE_LIMITS: { BOOKING_CREATE: { maxRequests: 10, windowMs: 60000 } },
}))

vi.mock('@/lib/errors', () => ({
  getErrorMessage: (err: any) => err?.message ?? 'Unknown error',
  getErrorDetails: (err: any) => err?.message ?? 'Unknown error',
}))

// The requires-payment branches (gym bookings) send BA/booker notifications and emails —
// mock these out so the payment-creation tests only exercise the payment-wiring behavior,
// not unrelated notification/email plumbing.
vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  sendNotificationToRoles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/notifications/recipientResolver', () => ({
  getBuildingAdminEmails: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue({ success: false, skipped: true }),
}))

function makeRequest(url: string, method = 'GET', body?: any) {
  const init: ConstructorParameters<typeof NextRequest>[1] = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

describe('GET /api/bookings', () => {
  let GET: any

  beforeEach(async () => {
    vi.clearAllMocks()
    // Re-wire chain methods after clearAllMocks
    for (const method of ['from', 'select', 'eq', 'in', 'gte', 'order', 'range', 'delete'] as const) {
      mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
    }
    mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    queryResult = { data: [], count: 0, error: null }
    const mod = await import('@/app/api/bookings/route')
    GET = mod.GET
  })

  it('should return bookings with default pagination', async () => {
    const mockBookings = [{ id: 'b1', booking_reference: 'REF-001' }]
    queryResult = { data: mockBookings, count: 1, error: null }

    const res = await GET(makeRequest('http://localhost:3000/api/bookings'))
    const data = await res.json()

    expect(res.status).toBe(200)
    // The route enriches each booking (course_name, payment status, etc.), so assert
    // the identifying fields are preserved rather than exact equality.
    expect(data.bookings).toHaveLength(1)
    expect(data.bookings[0].id).toBe('b1')
    expect(data.bookings[0].booking_reference).toBe('REF-001')
    expect(data.total).toBe(1)
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(20)
  })

  it('should handle pagination params', async () => {
    queryResult = { data: [], count: 0, error: null }

    const res = await GET(makeRequest('http://localhost:3000/api/bookings?page=2&pageSize=10'))
    const data = await res.json()

    expect(data.page).toBe(2)
    expect(data.pageSize).toBe(10)
  })

  it('should filter by single status', async () => {
    queryResult = { data: [], count: 0, error: null }

    await GET(makeRequest('http://localhost:3000/api/bookings?status=pending'))

    expect(mockSupabase.eq).toHaveBeenCalledWith('current_status', 'pending')
  })

  it('should filter by multiple statuses', async () => {
    queryResult = { data: [], count: 0, error: null }

    await GET(makeRequest('http://localhost:3000/api/bookings?status=pending,approved'))

    expect(mockSupabase.in).toHaveBeenCalledWith('current_status', ['pending', 'approved'])
  })

  it('should reject invalid status', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/bookings?status=invalid_status'))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('Invalid status')
  })

  it('should filter by dateFrom', async () => {
    queryResult = { data: [], count: 0, error: null }

    await GET(makeRequest('http://localhost:3000/api/bookings?dateFrom=2026-04-01'))

    expect(mockSupabase.gte).toHaveBeenCalledWith('booking_date', '2026-04-01')
  })

  it('should handle query errors', async () => {
    queryResult = { data: null as any, count: null as any, error: { message: 'DB error' } }

    const res = await GET(makeRequest('http://localhost:3000/api/bookings'))

    expect(res.status).toBe(500)
  })

  it('should show all bookings including pending external_paid ones for external users', async () => {
    // Mock external user
    const { requireAuthenticatedUser } = await import('@/lib/auth/guards')
    const mockExternalUser = {
      id: 'ext-user-1',
      auth_user_id: 'auth-ext-1',
      email: 'external@test.com',
      full_name: 'External User',
      user_type: 'external',
      account_status: 'active',
      roles: [{ name: 'external_client' }],
    }
    vi.mocked(requireAuthenticatedUser).mockResolvedValueOnce({ error: null, user: mockExternalUser as any })

    // Return bookings: pending, auto_approved, pending_user_response, internal
    queryResult = {
      data: [
        { id: 'b-ext-pending', booking_reference: 'EXT-001', booking_type: 'external_paid', current_status: 'pending', requires_payment: true, booking_facilities: [{ facility: { id: 'f1', name: 'Hall A', room_number: '101', floors: { floor_number: 1, buildings: { name: 'Building A' } } } }] },
        { id: 'b-ext-approved', booking_reference: 'EXT-002', booking_type: 'external_paid', current_status: 'auto_approved', requires_payment: true, booking_facilities: [{ facility: { id: 'f1', name: 'Hall A', room_number: '101', floors: { floor_number: 1, buildings: { name: 'Building A' } } } }] },
        { id: 'b-ext-awaiting', booking_reference: 'EXT-003', booking_type: 'external_paid', current_status: 'pending_user_response', requires_payment: true, booking_facilities: [{ facility: { id: 'f1', name: 'Hall A', room_number: '101', floors: { floor_number: 1, buildings: { name: 'Building A' } } } }] },
        { id: 'b-internal', booking_reference: 'INT-001', booking_type: 'internal_free', current_status: 'auto_approved', requires_payment: false, booking_facilities: [{ facility: { id: 'f2', name: 'Room B', room_number: '201', floors: { floor_number: 2, buildings: { name: 'Building B' } } } }] },
      ],
      count: 4,
      error: null,
    }

    // Mock payment query: no payments completed
    const originalFrom = mockSupabase.from
    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'payments') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }
      if (table === 'emergency_cancellation_requests' || table === 'emergency_reschedule_requests') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'courses') {
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }
      if (table === 'facilities') {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) }
      }
      if (table === 'users') {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) }
      }
      return mockSupabase
    })

    const res = await GET(makeRequest('http://localhost:3000/api/bookings'))
    const data = await res.json()

    expect(res.status).toBe(200)
    // All 4 bookings (including pending external booking) should be returned
    expect(data.bookings).toHaveLength(4)
    expect(data.bookings.find((b: any) => b.id === 'b-ext-pending')).toBeDefined()

    expect(data.bookings.find((b: any) => b.id === 'b-ext-approved')).toBeDefined()
    expect(data.bookings.find((b: any) => b.id === 'b-ext-awaiting')).toBeDefined()
    expect(data.bookings.find((b: any) => b.id === 'b-internal')).toBeDefined()

    // Restore
    mockSupabase.from = originalFrom
  })
})

describe('POST /api/bookings', () => {
  let POST: any

  beforeEach(async () => {
    vi.clearAllMocks()
    for (const method of ['from', 'select', 'eq', 'in', 'gte', 'order', 'range', 'delete', 'update'] as const) {
      mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
    }
    mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mockSupabase.insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'b-new', booking_reference: 'REF-NEW' }, error: null }) }) })
    queryResult = { data: [], count: 0, error: null }
    const mod = await import('@/app/api/bookings/route')
    POST = mod.POST
  })

  it('should reject invalid body', async () => {
    const res = await POST(makeRequest('http://localhost:3000/api/bookings', 'POST', {
      facility_id: 'not-a-uuid',
    }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.issues).toBeDefined()
  })

  it('should reject missing required fields', async () => {
    const res = await POST(makeRequest('http://localhost:3000/api/bookings', 'POST', {}))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.issues.length).toBeGreaterThan(0)
  })

  it('should reject invalid date format', async () => {
    const res = await POST(makeRequest('http://localhost:3000/api/bookings', 'POST', {
      facility_id: '00000000-0000-0000-0000-000000000001',
      booking_date: 'not-a-date',
      start_time: '09:00',
      end_time: '10:00',
      purpose: 'Test',
      booking_purpose: 'academic',
    }))
    const data = await res.json()

    expect(res.status).toBe(400)
  })

  it('should reject invalid booking_purpose', async () => {
    const res = await POST(makeRequest('http://localhost:3000/api/bookings', 'POST', {
      facility_id: '00000000-0000-0000-0000-000000000001',
      booking_date: '2026-04-01',
      start_time: '09:00',
      end_time: '10:00',
      purpose: 'Test',
      booking_purpose: 'invalid_purpose',
    }))
    const data = await res.json()

    expect(res.status).toBe(400)
  })

  // --- qr_at_submission invoice creation (Task 18) ---
  // These bookings must satisfy the requires_payment gate (gym facility + a paid purpose)
  // so the route reaches the `if (requiresPayment)` branches under test.
  const GYM_FACILITY_ID = '11111111-1111-4111-8111-111111111111'

  function gymBookingBody(overrides: Record<string, any> = {}) {
    return {
      facility_id: GYM_FACILITY_ID,
      booking_date: '2026-09-01',
      start_time: '09:00',
      end_time: '11:00',
      purpose: 'Birthday event',
      booking_purpose: 'personal',
      ...overrides,
    }
  }

  function gymFacilitySingle() {
    return {
      data: { id: GYM_FACILITY_ID, name: 'Gymnasium', is_available_for_rental: true, facility_types: { name: 'Gym' } },
      error: null,
    }
  }

  function mockSuccessfulRpc(bookingId = 'booking-123', bookingRef = 'REF-123') {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{
        out_booking_id: bookingId,
        out_booking_reference: bookingRef,
        out_conflict_found: false,
        out_error_message: null,
        out_conflict_reference: null,
      }],
      error: null,
    })
  }

  it('creates a payments row (qr_manual) immediately when payment_method_mode is qr_at_submission', async () => {
    mockSupabase.single
      .mockResolvedValueOnce(gymFacilitySingle()) // 1: facility fetch
      .mockResolvedValueOnce({ data: { key: 'payment_method_mode', value: 'qr_at_submission' }, error: null }) // 2: system_settings
      .mockResolvedValueOnce(gymFacilitySingle()) // 3: BookingPaymentService -> getRateConfig facility lookup
    mockSuccessfulRpc()

    const res = await POST(makeRequest('http://localhost:3000/api/bookings', 'POST', gymBookingBody()))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.status).toBe('pending')
    expect(data.requires_payment).toBe(true)

    const paymentInsertCall = mockSupabase.insert.mock.calls.find(
      ([arg]: any[]) => arg?.payment_method === 'qr_manual'
    )
    expect(paymentInsertCall).toBeTruthy()
    expect(paymentInsertCall![0]).toMatchObject({
      booking_id: 'booking-123',
      payment_method: 'qr_manual',
      payment_status: 'pending',
    })
  })

  it('does NOT create a payments row when payment_method_mode is paymongo (default/unset)', async () => {
    mockSupabase.single
      .mockResolvedValueOnce(gymFacilitySingle()) // 1: facility fetch
      .mockResolvedValueOnce({ data: null, error: null }) // 2: system_settings — no row, defaults to 'paymongo'
    mockSuccessfulRpc()

    const res = await POST(makeRequest('http://localhost:3000/api/bookings', 'POST', gymBookingBody()))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.requires_payment).toBe(true)
    expect(data.payment_id).toBeUndefined()

    const paymentInsertCall = mockSupabase.insert.mock.calls.find(
      ([arg]: any[]) => arg?.payment_method === 'qr_manual' || arg?.payment_method === 'paymongo_card'
    )
    expect(paymentInsertCall).toBeUndefined()
  })

  it('does NOT create a payments row when payment_method_mode is qr_after_approval (unchanged from today)', async () => {
    mockSupabase.single
      .mockResolvedValueOnce(gymFacilitySingle()) // 1: facility fetch
      .mockResolvedValueOnce({ data: { key: 'payment_method_mode', value: 'qr_after_approval' }, error: null }) // 2: system_settings
    mockSuccessfulRpc()

    const res = await POST(makeRequest('http://localhost:3000/api/bookings', 'POST', gymBookingBody()))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.requires_payment).toBe(true)

    const paymentInsertCall = mockSupabase.insert.mock.calls.find(
      ([arg]: any[]) => arg?.payment_method === 'qr_manual' || arg?.payment_method === 'paymongo_card'
    )
    expect(paymentInsertCall).toBeUndefined()
  })

  it('building admin self-booking uses qr_manual instead of paymongo_card when mode is qr_at_submission', async () => {
    const { requireAuthenticatedUser } = await import('@/lib/auth/guards')
    vi.mocked(requireAuthenticatedUser).mockResolvedValueOnce({ error: null, user: mockBuildingAdminUser as any })

    mockSupabase.single
      .mockResolvedValueOnce(gymFacilitySingle()) // 1: facility fetch
      .mockResolvedValueOnce({ data: { key: 'payment_method_mode', value: 'qr_at_submission' }, error: null }) // 2: system_settings
      .mockResolvedValueOnce(gymFacilitySingle()) // 3: BookingPaymentService -> getRateConfig facility lookup
    mockSuccessfulRpc()

    const res = await POST(makeRequest('http://localhost:3000/api/bookings', 'POST', gymBookingBody()))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.status).toBe('pending_user_response')

    const paymentInsertCall = mockSupabase.insert.mock.calls.find(
      ([arg]: any[]) => arg?.description?.includes('self-reservation by Building Admin')
    )
    expect(paymentInsertCall).toBeTruthy()
    expect(paymentInsertCall![0].payment_method).toBe('qr_manual')
  })
})
