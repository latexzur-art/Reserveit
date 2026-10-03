import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAcademicHeadUser, mockAuthGuard } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockAcademicHeadUser))

let queryResult: any = { data: null, error: null }
const mockSupabase: any = {}
const chainMethods = ['from', 'select', 'eq', 'in', 'single', 'update', 'insert', 'maybeSingle', 'gte'] as const
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

vi.mock('@/backend/notifications/recipientResolver', () => ({
  getBuildingAdminEmails: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/errors', () => ({
  getErrorMessage: (err: any) => err?.message ?? 'Unknown error',
  getErrorDetails: (err: any) => err?.message ?? 'Unknown error',
}))

const REQUEST_UUID = 'c1b2a3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const BOOKING_UUID = 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const USER_UUID = 'u1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c'

function makeRequest(body: any) {
  return new Request(`http://localhost:3000/api/academic-head/cancellation-requests/${REQUEST_UUID}/respond`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const mockParams = { params: Promise.resolve({ id: REQUEST_UUID }) }

describe('AH respond — paid booking guard', () => {
  let POST: any

  beforeEach(async () => {
    vi.clearAllMocks()
    for (const method of chainMethods) {
      mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
    }
    queryResult = { data: null, error: null }

    const mod = await import('@/app/api/academic-head/cancellation-requests/[id]/respond/route')
    POST = mod.POST
  })

  it('should return 403 when cancellation request has refund_destination_name (paid booking)', async () => {
    // cancellation request query — has refund_destination_name set (indicates paid booking)
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: REQUEST_UUID,
        booking_id: BOOKING_UUID,
        user_id: USER_UUID,
        status: 'pending',
        reason: 'Schedule conflict',
        refund_window_met: true,
        refund_destination_name: 'Juan Dela Cruz',
      },
      error: null,
    })

    const res = await POST(makeRequest({ action: 'approve_no_strike' }), mockParams)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('Paid booking')
    expect(body.error).toContain('Building Admin')
  })

  it('should allow AH to respond when refund_destination_name is null (unpaid booking)', async () => {
    // cancellation request query — no refund_destination_name (unpaid booking)
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: REQUEST_UUID,
        booking_id: BOOKING_UUID,
        user_id: USER_UUID,
        status: 'pending',
        reason: 'Schedule conflict',
        refund_window_met: false,
        refund_destination_name: null,
      },
      error: null,
    })
    // booking query
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, booking_reference: 'BK-001', current_status: 'cancellation_requested', requires_payment: false, booking_type: 'academic' },
      error: null,
    })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ action: 'approve_no_strike' }), mockParams)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('should return 403 when refund_destination_name is null but booking requires_payment is true', async () => {
    // cancellation request query — refund_destination_name is null
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: REQUEST_UUID,
        booking_id: BOOKING_UUID,
        user_id: USER_UUID,
        status: 'pending',
        reason: 'Schedule conflict',
        refund_window_met: false,
        refund_destination_name: null,
      },
      error: null,
    })
    // booking query — requires_payment is true (e.g. pre-payment paid booking)
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, booking_reference: 'BK-002', current_status: 'cancellation_requested', requires_payment: true, booking_type: 'internal_paid' },
      error: null,
    })

    const res = await POST(makeRequest({ action: 'approve_no_strike' }), mockParams)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('Paid booking cancellations must be handled by Building Admin')
  })

  it('should return 403 when booking_type is external_paid', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: REQUEST_UUID,
        booking_id: BOOKING_UUID,
        user_id: USER_UUID,
        status: 'pending',
        reason: 'Schedule conflict',
        refund_window_met: false,
        refund_destination_name: null,
      },
      error: null,
    })
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, booking_reference: 'BK-003', current_status: 'cancellation_requested', requires_payment: false, booking_type: 'external_paid' },
      error: null,
    })

    const res = await POST(makeRequest({ action: 'approve_no_strike' }), mockParams)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('Paid booking cancellations must be handled by Building Admin')
  })
})
