/**
 * Unit tests — Gap 1: Non-Gym Rentable Facilities Bypass Payment
 *
 * Verifies that `requiresPayment` in the booking route checks BOTH
 * `isGymFacility` AND `facility.is_available_for_rental`.
 *
 * Before the fix, only gym facilities triggered payment — auditoriums,
 * MPH, AVR, labs with `is_available_for_rental = true` were billed as free.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockFacultyUser, mockAuthGuard } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))

// Mock `after` from next/server — it requires a request scope that unit tests don't have
vi.mock('next/server', async (importOriginal) => {
  const orig = await importOriginal<typeof import('next/server')>()
  return { ...orig, after: vi.fn((fn: () => Promise<void>) => { void fn() }) }
})

let queryResult = { data: [] as any[], count: 0, error: null as any }

const mockSupabase: any = {}
const chainMethods = ['from', 'select', 'eq', 'in', 'gte', 'order', 'range', 'delete', 'update'] as const
for (const method of chainMethods) {
  mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
}
mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null })
mockSupabase.insert = vi.fn().mockReturnValue(mockSupabase)
mockSupabase.single = vi.fn().mockResolvedValue({ data: { id: 'b-new', booking_reference: 'REF-NEW' }, error: null })

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

function makeRequest(body?: any) {
  return new NextRequest(new URL('http://localhost:3000/api/bookings'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const RENTABLE_FACILITY_ID = '22222222-2222-4222-8222-222222222222'
const NON_RENTABLE_FACILITY_ID = '33333333-3333-4333-8333-333333333333'
const GYM_FACILITY_ID = '11111111-1111-4111-8111-111111111111'

function rentableFacility() {
  return {
    data: {
      id: RENTABLE_FACILITY_ID,
      name: 'Auditorium',
      is_available_for_rental: true,
      facility_types: { name: 'Auditorium' },
    },
    error: null,
  }
}

function nonRentableFacility() {
  return {
    data: {
      id: NON_RENTABLE_FACILITY_ID,
      name: 'Classroom 101',
      is_available_for_rental: false,
      facility_types: { name: 'Classroom' },
    },
    error: null,
  }
}

function gymFacility() {
  return {
    data: {
      id: GYM_FACILITY_ID,
      name: 'Gymnasium',
      is_available_for_rental: true,
      facility_types: { name: 'Gym' },
    },
    error: null,
  }
}

function bookingBody(facilityId: string, overrides: Record<string, any> = {}) {
  return {
    facility_id: facilityId,
    booking_date: '2026-09-01',
    start_time: '09:00',
    end_time: '11:00',
    purpose: 'Birthday event',
    booking_purpose: 'commercial',
    ...overrides,
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

describe('Gap 1: requiresPayment checks is_available_for_rental', () => {
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

  it('non-gym facility with is_available_for_rental=true + commercial purpose → requires_payment=true', async () => {
    mockSupabase.single
      .mockResolvedValueOnce(rentableFacility())  // facility fetch
      .mockResolvedValueOnce({ data: { key: 'payment_method_mode', value: 'qr_at_submission' }, error: null }) // system_settings
      .mockResolvedValueOnce(rentableFacility())  // BookingPaymentService -> getRateConfig
    mockSuccessfulRpc()

    const res = await POST(makeRequest(bookingBody(RENTABLE_FACILITY_ID)))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.requires_payment).toBe(true)
  })

  it('non-gym facility with is_available_for_rental=false + commercial purpose → requires_payment=false (no payment in response)', async () => {
    mockSupabase.single
      .mockResolvedValueOnce(nonRentableFacility())  // facility fetch
    mockSuccessfulRpc()

    const res = await POST(makeRequest(bookingBody(NON_RENTABLE_FACILITY_ID)))
    const data = await res.json()

    expect(res.status).toBe(201)
    // Non-payment path returns 'processing' status without requires_payment field
    expect(data.requires_payment).toBeUndefined()
    expect(data.status).toBe('processing')
  })

  it('gym facility + commercial purpose → requires_payment=true (existing behavior preserved)', async () => {
    mockSupabase.single
      .mockResolvedValueOnce(gymFacility())  // facility fetch
      .mockResolvedValueOnce({ data: { key: 'payment_method_mode', value: 'qr_at_submission' }, error: null }) // system_settings
      .mockResolvedValueOnce(gymFacility())  // BookingPaymentService -> getRateConfig
    mockSuccessfulRpc()

    const res = await POST(makeRequest(bookingBody(GYM_FACILITY_ID)))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.requires_payment).toBe(true)
  })

  it('rentable facility + academic purpose → requires_payment=false (academic is not a payment purpose)', async () => {
    mockSupabase.single
      .mockResolvedValueOnce(rentableFacility())
    mockSuccessfulRpc()

    const res = await POST(makeRequest(bookingBody(RENTABLE_FACILITY_ID, { booking_purpose: 'academic' })))
    const data = await res.json()

    expect(res.status).toBe(201)
    // Non-payment path returns 'processing' status without requires_payment field
    expect(data.requires_payment).toBeUndefined()
    expect(data.status).toBe('processing')
  })

  it('non-rentable facility + personal purpose → requires_payment=false (no payment in response)', async () => {
    mockSupabase.single
      .mockResolvedValueOnce(nonRentableFacility())
    mockSuccessfulRpc()

    const res = await POST(makeRequest(bookingBody(NON_RENTABLE_FACILITY_ID, { booking_purpose: 'personal' })))
    const data = await res.json()

    expect(res.status).toBe(201)
    // Non-payment path returns 'processing' status without requires_payment field
    expect(data.requires_payment).toBeUndefined()
    expect(data.status).toBe('processing')
  })
})
