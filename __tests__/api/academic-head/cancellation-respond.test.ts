import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAcademicHeadUser, mockAuthGuard } from '../../mocks/auth'
import { requireAuthenticatedUser } from '@/lib/auth/guards'

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

describe('POST /api/academic-head/cancellation-requests/[id]/respond', () => {
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

  it('should require academic_head role', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(requireAuthenticatedUser).mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null as any,
    })

    const res = await POST(makeRequest({ action: 'approve_no_strike' }), mockParams)
    expect(res.status).toBe(401)
  })

  it('should validate action value', async () => {
    const res = await POST(makeRequest({ action: 'invalid' }), mockParams)
    expect(res.status).toBe(400)
  })

  it('should return 404 if request not found', async () => {
    // request query returns null
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

    const res = await POST(makeRequest({ action: 'approve_no_strike' }), mockParams)
    expect(res.status).toBe(404)
  })

  it('should return 400 if request is not pending', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: REQUEST_UUID, booking_id: BOOKING_UUID, user_id: USER_UUID, status: 'approved_no_strike' },
      error: null,
    })

    const res = await POST(makeRequest({ action: 'approve_no_strike' }), mockParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('status')
  })

  it('should approve cancellation with no strike', async () => {
    // request query
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: REQUEST_UUID, booking_id: BOOKING_UUID, user_id: USER_UUID, status: 'pending', reason: 'Schedule conflict' },
      error: null,
    })
    // booking query
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, booking_reference: 'BK-001', current_status: 'cancellation_requested' },
      error: null,
    })
    // update request status
    mockSupabase.eq.mockReturnValueOnce(mockSupabase)
    // update booking status via rpc
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ action: 'approve_no_strike', review_notes: 'Legitimate reason' }), mockParams)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('should approve cancellation with strike', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: REQUEST_UUID, booking_id: BOOKING_UUID, user_id: USER_UUID, status: 'pending', reason: 'Changed my mind' },
      error: null,
    })
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, booking_reference: 'BK-001', current_status: 'cancellation_requested' },
      error: null,
    })
    // user query for strike increment
    mockSupabase.single.mockResolvedValueOnce({
      data: { consecutive_cancellations: 1 },
      error: null,
    })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ action: 'approve_with_strike' }), mockParams)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('should reject cancellation and revert booking status', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: REQUEST_UUID, booking_id: BOOKING_UUID, user_id: USER_UUID, status: 'pending', original_status: 'approved', reason: 'No longer needed' },
      error: null,
    })
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, booking_reference: 'BK-001', current_status: 'cancellation_requested' },
      error: null,
    })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ action: 'reject', review_notes: 'Not a valid reason' }), mockParams)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('marks the completed payment refund_requested and notifies building_admin when approving a refund-window-met booking', async () => {
    const { sendNotificationToRoles } = await import('@/backend/booking/autoDecisionRouter')

    // cancellation request query
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: REQUEST_UUID, booking_id: BOOKING_UUID, user_id: USER_UUID, status: 'pending', reason: 'Schedule conflict', refund_window_met: true },
      error: null,
    })
    // booking query
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, booking_reference: 'BK-001', current_status: 'cancellation_requested' },
      error: null,
    })
    // payments lookup (completed payment found)
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'pay-1', payment_status: 'completed' },
      error: null,
    })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ action: 'approve_no_strike' }), mockParams)
    expect(res.status).toBe(200)

    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ payment_status: 'refund_requested' })
    )
    expect(sendNotificationToRoles).toHaveBeenCalledWith(
      mockSupabase,
      ['building_admin'],
      expect.objectContaining({ source_type: 'cancellation_request', source_id: REQUEST_UUID, priority: 'high' })
    )
  })

  it('does not trigger the refund hook when refund_window_met is false', async () => {
    const { sendNotificationToRoles } = await import('@/backend/booking/autoDecisionRouter')

    mockSupabase.single.mockResolvedValueOnce({
      data: { id: REQUEST_UUID, booking_id: BOOKING_UUID, user_id: USER_UUID, status: 'pending', reason: 'Schedule conflict', refund_window_met: false },
      error: null,
    })
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, booking_reference: 'BK-001', current_status: 'cancellation_requested' },
      error: null,
    })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ action: 'approve_no_strike' }), mockParams)
    expect(res.status).toBe(200)

    expect(mockSupabase.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ payment_status: 'refund_requested' })
    )
    expect(sendNotificationToRoles).not.toHaveBeenCalled()
  })

  it('does not trigger the refund hook when refund_window_met is true but no completed payment exists', async () => {
    const { sendNotificationToRoles } = await import('@/backend/booking/autoDecisionRouter')

    mockSupabase.single.mockResolvedValueOnce({
      data: { id: REQUEST_UUID, booking_id: BOOKING_UUID, user_id: USER_UUID, status: 'pending', reason: 'Schedule conflict', refund_window_met: true },
      error: null,
    })
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, booking_reference: 'BK-001', current_status: 'cancellation_requested' },
      error: null,
    })
    // payments lookup finds nothing
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ action: 'approve_no_strike' }), mockParams)
    expect(res.status).toBe(200)

    expect(mockSupabase.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ payment_status: 'refund_requested' })
    )
    expect(sendNotificationToRoles).not.toHaveBeenCalled()
  })

  it('does not trigger the refund hook when rejecting, even if refund_window_met is true', async () => {
    const { sendNotificationToRoles } = await import('@/backend/booking/autoDecisionRouter')

    mockSupabase.single.mockResolvedValueOnce({
      data: { id: REQUEST_UUID, booking_id: BOOKING_UUID, user_id: USER_UUID, status: 'pending', original_status: 'approved', reason: 'No longer needed', refund_window_met: true },
      error: null,
    })
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, booking_reference: 'BK-001', current_status: 'cancellation_requested' },
      error: null,
    })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ action: 'reject', review_notes: 'Not a valid reason' }), mockParams)
    expect(res.status).toBe(200)

    expect(mockSupabase.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ payment_status: 'refund_requested' })
    )
    expect(sendNotificationToRoles).not.toHaveBeenCalled()
  })

  it('emails building admins with the refund-owed template on the refund-window-met + completed-payment approval branch', async () => {
    const { sendBrevoEmail } = await import('@/backend/notifications/brevoEmailService')
    const { getBuildingAdminEmails } = await import('@/backend/notifications/recipientResolver')
    vi.mocked(getBuildingAdminEmails).mockResolvedValueOnce(['admin@example.com'])

    // cancellation request query
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: REQUEST_UUID, booking_id: BOOKING_UUID, user_id: USER_UUID, status: 'pending', reason: 'Schedule conflict', refund_window_met: true },
      error: null,
    })
    // booking query
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: BOOKING_UUID, booking_reference: 'BK-5001', current_status: 'cancellation_requested' },
      error: null,
    })
    // payments lookup (completed payment found)
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'pay-1', payment_status: 'completed', total_amount: 2500 },
      error: null,
    })
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest({ action: 'approve_no_strike' }), mockParams)
    expect(res.status).toBe(200)

    expect(sendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['admin@example.com'],
        subject: expect.stringMatching(/^\[ACTION REQUIRED\] Refund Owed — BK-5001$/),
      })
    )
    const emailArg = vi.mocked(sendBrevoEmail).mock.calls[0][0]
    expect(emailArg.htmlBody).toContain('₱2,500.00')
  })
})
