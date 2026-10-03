import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockBuildingAdminUser } from '../../../mocks/auth'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/guards', () => ({
  requireBuildingAdminStrict: vi.fn().mockResolvedValue({ user: mockBuildingAdminUser, error: null }),
  requireAuthenticatedUser: vi.fn().mockResolvedValue({ user: mockBuildingAdminUser, error: null }),
}))

let queryResult: any = { data: null, error: null }
const mockSupabase: any = {}
const chainMethods = ['from', 'select', 'eq', 'not', 'order', 'in', 'single', 'update', 'insert', 'maybeSingle', 'neq', 'lt', 'gt', 'limit'] as const
for (const method of chainMethods) {
  mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
}
mockSupabase.rpc = vi.fn().mockResolvedValue({ data: true, error: null })

// Track sequential query results
let queryResults: any[] = []
let queryIndex = 0

mockSupabase.then = function (resolve: any, reject?: any) {
  const result = queryResults.length > 0 ? queryResults[queryIndex++] ?? queryResult : queryResult
  return Promise.resolve(result).then(resolve, reject)
}

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockSupabase,
}))

vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  sendNotificationToRoles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/notifications/recipientResolver', () => ({
  resolveUserEmail: vi.fn().mockResolvedValue({ emailTo: 'user@example.com', name: 'Test User' }),
}))

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/backend/admin/admin-audit.service', () => ({
  AdminAuditService: { log: vi.fn().mockResolvedValue(undefined) },
}))

const mockCalculateAmount = vi.fn().mockResolvedValue({ amount: 500, breakdown: [], rateConfig: undefined })
vi.mock('@/backend/booking/paymentService', () => ({
  BookingPaymentService: {
    calculateAmount: (...args: any[]) => mockCalculateAmount(...args),
  },
}))

const mockCheckBookingConflict = vi.fn().mockResolvedValue({ conflict: false })
vi.mock('@/lib/bookings/check-conflict', () => ({
  checkBookingConflict: (...args: any[]) => mockCheckBookingConflict(...args),
}))

const BOOKING_UUID = 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const USER_UUID = 'u1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c'
const FACILITY_UUID = 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c'

import { POST } from '@/app/api/admin/building/bookings/[id]/extend/route'

describe('POST /api/admin/building/bookings/[id]/extend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryResults = []
    queryIndex = 0
    for (const method of chainMethods) {
      mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
    }
    mockSupabase.rpc = vi.fn().mockResolvedValue({ data: true, error: null })

    // Reset mocks to defaults
    mockCheckBookingConflict.mockResolvedValue({ conflict: false })
    mockCalculateAmount.mockResolvedValue({ amount: 500, breakdown: [], rateConfig: undefined })
  })

  const approvedBooking = {
    id: BOOKING_UUID,
    user_id: USER_UUID,
    booking_reference: 'BK-20260814-001',
    booking_date: '2026-08-19',
    start_time: '10:00:00',
    end_time: '14:00:00',
    booking_purpose: 'personal',
    booking_type: 'internal_paid',
    current_status: 'approved',
    requires_payment: true,
    is_extension: false,
    extension_of_booking_id: null,
    metadata: {},
    booking_facilities: [{ facility_id: FACILITY_UUID, facility: [{ id: FACILITY_UUID, name: 'Gymnasium', facility_types: [{ name: 'Gymnasium' }] }] }],
  }

  it('extends an approved booking and records cash payment', async () => {
    queryResults = [
      { data: approvedBooking, error: null },
      { data: { id: 'ext-uuid', booking_reference: 'BK-20260814-001-EXT' }, error: null },
      { data: null, error: null },
      { data: { id: 'payment-uuid' }, error: null },
      { data: null, error: null },
    ]
    queryIndex = 0

    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_end_time: '16:00', record_payment: true }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.extension_booking_id).toBe('ext-uuid')
    expect(body.extension_start_time).toBe('14:00')
    expect(body.extension_end_time).toBe('16:00')
    expect(body.payment_recorded).toBe(true)
  })

  it('returns 404 when booking not found', async () => {
    queryResults = [{ data: null, error: { message: 'Not found' } }]
    queryIndex = 0

    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_end_time: '16:00' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('not found')
  })

  it('rejects extending an extension booking', async () => {
    queryResults = [{
      data: { ...approvedBooking, is_extension: true, extension_of_booking_id: 'parent-id' },
      error: null,
    }]
    queryIndex = 0

    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_end_time: '16:00' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('cannot be extended further')
  })

  it('rejects extending a non-approved booking', async () => {
    queryResults = [{
      data: { ...approvedBooking, current_status: 'pending' },
      error: null,
    }]
    queryIndex = 0

    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_end_time: '16:00' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Only approved bookings')
  })

  it('rejects new_end_time <= current end_time', async () => {
    queryResults = [{ data: approvedBooking, error: null }]
    queryIndex = 0

    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_end_time: '13:00' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('must be after')
  })

  it('rejects when conflict exists in extension window', async () => {
    queryResults = [{ data: approvedBooking, error: null }]
    queryIndex = 0

    mockCheckBookingConflict.mockResolvedValueOnce({ conflict: true, conflicting_booking_reference: 'BK-OTHER' })

    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_end_time: '16:00' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.toLowerCase()).toContain('conflict')
  })

  it('rejects when non-gym purpose booking is extended', async () => {
    queryResults = [{
      data: { ...approvedBooking, booking_purpose: 'academic' },
      error: null,
    }]
    queryIndex = 0

    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_end_time: '16:00' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('personal, community, or commercial')
  })

  it('validates request body', async () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_end_time: 'invalid-time' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation')
  })

  it('extends without recording payment when record_payment is false', async () => {
    queryResults = [
      { data: approvedBooking, error: null },
      { data: { id: 'ext-uuid', booking_reference: 'BK-20260814-001-EXT' }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]
    queryIndex = 0

    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_end_time: '16:00', record_payment: false }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.payment_recorded).toBe(false)
  })

  it('rejects end time past 21:00', async () => {
    queryResults = [{ data: approvedBooking, error: null }]
    queryIndex = 0

    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_end_time: '22:00' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('9:00 PM')
  })
})
