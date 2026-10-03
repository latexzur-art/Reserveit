import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => ({
  requireBuildingAdminStrict: vi.fn().mockResolvedValue({ user: mockBuildingAdminUser, error: null }),
  requireAuthenticatedUser: vi.fn().mockResolvedValue({ user: mockBuildingAdminUser, error: null }),
}))

let queryResult: any = { data: null, error: null }
const mockSupabase: any = {}
const chainMethods = ['from', 'select', 'eq', 'not', 'order', 'in', 'single', 'update', 'insert', 'maybeSingle'] as const
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

vi.mock('@/backend/notifications/recipientResolver', () => ({
  resolveUserEmail: vi.fn().mockResolvedValue({ emailTo: 'user@test.com', name: 'Test User' }),
  getBuildingAdminEmails: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue(undefined),
}))

const REQUEST_UUID = 'c1b2a3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const BOOKING_UUID = 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const USER_UUID = 'u1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c'

import { GET } from '@/app/api/admin/building/cancellation-requests/route'
import { POST as respondPOST } from '@/app/api/admin/building/cancellation-requests/[id]/respond/route'
import { NextRequest } from 'next/server'

describe('Building Admin Paid Cancellation Requests API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const method of chainMethods) {
      mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
    }
  })

  it('lists paid cancellation requests for Building Admin', async () => {
    queryResult = {
      data: [
        {
          id: REQUEST_UUID,
          booking_id: BOOKING_UUID,
          refund_destination_name: 'John Doe',
          status: 'pending',
        },
      ],
      error: null,
    }

    const req = new NextRequest('http://localhost:3000/api/admin/building/cancellation-requests?status=pending')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.requests).toHaveLength(1)
    expect(data.requests[0].refund_destination_name).toBe('John Doe')
  })

  it('allows Building Admin to approve paid booking cancellation with refund', async () => {
    mockSupabase.single = vi.fn()
      .mockResolvedValueOnce({
        data: {
          id: REQUEST_UUID,
          booking_id: BOOKING_UUID,
          user_id: USER_UUID,
          status: 'pending',
          reason: 'Schedule conflict',
          original_status: 'approved',
          refund_window_met: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: BOOKING_UUID,
          current_status: 'approved',
          booking_reference: 'BK-PAID-001',
        },
        error: null,
      })

    mockSupabase.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'pay-123', payment_status: 'completed' },
      error: null,
    })

    const req = new NextRequest(`http://localhost:3000/api/admin/building/cancellation-requests/${REQUEST_UUID}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve_full_refund' }),
    })

    const res = await respondPOST(req, { params: Promise.resolve({ id: REQUEST_UUID }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.action).toBe('approved')
    expect(data.refund_owed).toBe(true)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_booking_status', expect.objectContaining({
      p_booking_id: BOOKING_UUID,
      p_new_status: 'cancelled',
    }))
  })
})
