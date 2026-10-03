import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockFacultyUser, mockAuthGuard } from '../../mocks/auth'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))

// Sequential single() results
let singleResults: any[] = []
let singleCallIndex = 0
let queryResult: any = { data: null, error: null }

const mockSupabase: any = {}
for (const m of ['from', 'select', 'eq', 'in', 'gte', 'order', 'range', 'neq', 'lt', 'gt', 'limit', 'maybeSingle'] as const) {
  mockSupabase[m] = vi.fn().mockImplementation(() => mockSupabase)
}
mockSupabase.update = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
})
mockSupabase.insert = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'override-1' }, error: null }),
  }),
  eq: vi.fn().mockResolvedValue({ error: null }),
})
mockSupabase.single = vi.fn().mockImplementation(async () => {
  const result = singleResults[singleCallIndex] ?? { data: null, error: null }
  singleCallIndex++
  return result
})
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
  sendBrevoEmail: vi.fn().mockResolvedValue({ success: false, skipped: true }),
}))

vi.mock('@/backend/notifications/emailTemplates', () => ({
  reservationRescheduledInstantEmail: vi.fn().mockReturnValue({ subject: 'S', htmlBody: '<p>H</p>' }),
}))

vi.mock('@/backend/booking/facilityMismatchChecker', () => ({
  checkFacilityPurposeMismatch: vi.fn().mockResolvedValue({ flag: 'OK', forceManualReview: false }),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(null),
  checkRateLimitAsync: vi.fn().mockResolvedValue(null),
  RATE_LIMITS: { BOOKING_CREATE: { maxRequests: 10, windowMs: 60000 } },
}))

// Mock BuildingPricingService — tests will configure per-test
const mockGetRateConfig = vi.fn()

vi.mock('@/backend/admin/building/building-pricing.service', () => ({
  BuildingPricingService: {
    getRateConfig: mockGetRateConfig,
  },
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(url: string, method = 'POST', body?: any) {
  const init: ConstructorParameters<typeof NextRequest>[1] = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

function bookingData(overrides: Record<string, any> = {}) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa',
    user_id: mockFacultyUser.id,
    booking_reference: 'REF-001',
    current_status: 'awaiting_reschedule',
    reschedule_deadline: new Date(Date.now() + 86400000).toISOString(),
    original_date: '2026-09-01',
    original_start_time: '07:00:00',
    original_end_time: '10:00:00',
    original_facility_id: '11111111-1111-4111-a111-111111111111',
    booking_date: '2026-09-01',
    start_time: '07:00:00',
    end_time: '10:00:00',
    session_type: 'lecture',
    booking_purpose: 'academic',
    department_id: 'dept-001',
    booking_facilities: [{ facility_id: '11111111-1111-4111-a111-111111111111' }],
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('reschedule pricing differential', () => {
  let POST: any

  beforeEach(async () => {
    vi.clearAllMocks()
    singleResults = []
    singleCallIndex = 0
    queryResult = { data: null, error: null }

    for (const m of ['from', 'select', 'eq', 'in', 'gte', 'order', 'range', 'neq', 'lt', 'gt', 'limit', 'maybeSingle'] as const) {
      mockSupabase[m] = vi.fn().mockImplementation(() => mockSupabase)
    }
    mockSupabase.single = vi.fn().mockImplementation(async () => {
      const result = singleResults[singleCallIndex] ?? { data: null, error: null }
      singleCallIndex++
      return result
    })
    mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mockSupabase.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mockSupabase.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'override-1' }, error: null }),
      }),
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mockSupabase.then = function (resolve: any, reject?: any) {
      return Promise.resolve(queryResult).then(resolve, reject)
    }

    // Re-import with fresh mocks
    const mod = await import('@/app/api/bookings/[id]/reschedule-offer/route')
    POST = mod.POST
  })

  it('rejects reschedule to a higher-cost facility with price difference', async () => {
    // Step 1: booking fetch (single())
    singleResults = [
      { data: bookingData(), error: null },
      // Step 3: facility fetch (after term check that returns no active term via queryResult)
      { data: { id: '11111111-1111-4111-a111-111111111111', primary_department_id: null }, error: null },
    ]
    // Conflict check uses thenable — no conflict
    queryResult = { data: [], error: null }

    // Original facility: cheap (default fallback rates: ₱580 AM)
    // New facility: expensive
    mockGetRateConfig
      .mockResolvedValueOnce(null)  // original facility — null = use defaults (₱580 AM)
      .mockResolvedValueOnce({      // new facility — expensive
        amRatePerHour: 1200,
        pmRatePerHour: 1500,
        pmCutoffHour: 17,
      })

    const req = makeRequest('http://localhost:3000/api/bookings/aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa/reschedule-offer', 'POST', {
      booking_date: '2026-09-02',
      start_time: '07:00',
      end_time: '10:00',
      facility_id: '22222222-2222-4222-a222-222222222222',
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa' }) })
    const body = await res.json()

    // Should reject because the new facility costs more than the original
    expect(res.status).toBe(400)
    expect(body.check).toBe('RATE_DIFFERENTIAL')
    expect(body.price_difference_centavos).toBeGreaterThan(0)
  })

  it('records downgrade credit when rescheduling to a cheaper slot', async () => {
    const { sendNotificationToRoles } = await import('@/backend/booking/autoDecisionRouter')

    singleResults = [
      { data: bookingData(), error: null },
      { data: { id: '22222222-2222-4222-a222-222222222222', primary_department_id: null }, error: null },
    ]
    queryResult = { data: [], error: null }

    // Original facility: expensive (₱1200/hr AM × 3h = ₱3600)
    // New facility: cheap (₱580/hr AM × 3h = ₱1740)
    // Difference: ₱1860 = 186000 centavos
    mockGetRateConfig
      .mockResolvedValueOnce({        // original facility (1111...)
        amRatePerHour: 1200,
        pmRatePerHour: 1500,
        pmCutoffHour: 17,
      })
      .mockResolvedValueOnce({        // new facility (2222...)
        amRatePerHour: 580,
        pmRatePerHour: 780,
        pmCutoffHour: 17,
      })

    const req = makeRequest('http://localhost:3000/api/bookings/aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa/reschedule-offer', 'POST', {
      booking_date: '2026-09-02',
      start_time: '07:00',
      end_time: '10:00',
      facility_id: '22222222-2222-4222-a222-222222222222',
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    // Should notify building admin about the downgrade credit
    expect(sendNotificationToRoles).toHaveBeenCalledWith(
      expect.anything(),
      ['building_admin'],
      expect.objectContaining({
        title: expect.stringContaining('Downgrade Credit'),
        message: expect.stringContaining('1860'),
      })
    )
  })

  it('allows reschedule when new facility costs the same or less', async () => {
    singleResults = [
      { data: bookingData(), error: null },
      { data: { id: '11111111-1111-4111-a111-111111111111', primary_department_id: null }, error: null },
    ]
    queryResult = { data: [], error: null }

    // Original facility: expensive, New facility: cheap
    mockGetRateConfig
      .mockResolvedValueOnce({        // original facility
        amRatePerHour: 1200,
        pmRatePerHour: 1500,
        pmCutoffHour: 17,
      })
      .mockResolvedValueOnce({        // new facility
        amRatePerHour: 580,
        pmRatePerHour: 780,
        pmCutoffHour: 17,
      })

    const req = makeRequest('http://localhost:3000/api/bookings/aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa/reschedule-offer', 'POST', {
      booking_date: '2026-09-02',
      start_time: '07:00',
      end_time: '10:00',
      facility_id: '11111111-1111-4111-a111-111111111111',
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa' }) })
    const body = await res.json()

    // Should succeed — new facility is cheaper
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})

describe('computeExtraCentavos with facility rates', () => {
  it('uses facility-specific rates when computing extra charge', async () => {
    const { computeExtraCentavos } = await import('@/backend/booking/emergencyRescheduleRequestService')

    // With default hardcoded rates (₱580 AM / ₱780 PM):
    // 3h AM at ₱580 = 1740
    const defaultResult = computeExtraCentavos('07:00', '10:00', '07:00', '13:00')
    // 6h AM at ₱580 = 3480 → extra = 3480 - 1740 = 174000 centavos
    expect(defaultResult).toBe(174000)

    // With custom facility rates (₱1200 AM / ₱1500 PM):
    const customRates = { amRatePerHour: 1200, pmRatePerHour: 1500, pmCutoffHour: 17 }
    const customResult = computeExtraCentavos('07:00', '10:00', '07:00', '13:00', undefined, customRates)
    // 6h AM at ₱1200 = 7200, original 3h at ₱1200 = 3600 → extra = 360000 centavos
    expect(customResult).toBe(360000)

    // Custom result should differ from default (proves rates are used)
    expect(customResult).not.toBe(defaultResult)
  })

  it('passes addons through to computeBookingAmount', async () => {
    const { computeExtraCentavos } = await import('@/backend/booking/emergencyRescheduleRequestService')

    // Without addons
    const withoutAddons = computeExtraCentavos('07:00', '10:00', '07:00', '13:00')

    // With sound addon applied to both original and proposed (same addons = flat fee cancels in differential)
    const withSoundBoth = computeExtraCentavos('07:00', '10:00', '07:00', '13:00', { sound: true })

    // When the same addon applies to both sides, the flat fee cancels out in the differential
    expect(withSoundBoth).toBe(withoutAddons)

    // But with different rates, the differential DOES change (rates affect hourly, not flat)
    const withRatesAndAddons = computeExtraCentavos('07:00', '10:00', '07:00', '13:00', { sound: true }, { amRatePerHour: 1200, pmRatePerHour: 1500 })
    expect(withRatesAndAddons).not.toBe(withoutAddons)
  })
})
