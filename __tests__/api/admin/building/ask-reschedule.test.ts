import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockBuildingAdminUser } from '../../../mocks/auth'
import { NextRequest } from 'next/server'

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
mockSupabase.rpc = vi.fn().mockResolvedValue({ data: true, error: null })

mockSupabase.then = function (resolve: any, reject?: any) {
  return Promise.resolve(queryResult).then(resolve, reject)
}

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockSupabase,
}))

vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/notifications/recipientResolver', () => ({
  resolveUserEmail: vi.fn().mockResolvedValue({ emailTo: 'user@example.com', name: 'Nathan Mendoza' }),
}))

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/backend/notifications/emailTemplates', () => ({
  askUserToRescheduleEmail: vi.fn().mockReturnValue({ subject: 'Reschedule Request', htmlBody: '<p>test</p>' }),
}))

vi.mock('@/backend/admin/admin-audit.service', () => ({
  AdminAuditService: { log: vi.fn().mockResolvedValue(undefined) },
}))

const BOOKING_UUID = 'b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const USER_UUID = 'u1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c'

import { POST } from '@/app/api/admin/building/bookings/[id]/ask-reschedule/route'

describe('POST /api/admin/building/bookings/[id]/ask-reschedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const method of chainMethods) {
      mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
    }
    mockSupabase.rpc = vi.fn().mockResolvedValue({ data: true, error: null })
  })

  it('successfully asks user to reschedule for an approved booking', async () => {
    queryResult = {
      data: {
        id: BOOKING_UUID,
        user_id: USER_UUID,
        booking_reference: 'BK-20260814-001',
        current_status: 'approved',
        booking_date: '2026-08-19',
        start_time: '12:30:00',
        end_time: '14:00:00',
        reschedule_deadline: null,
        original_date: null,
        original_start_time: null,
        original_end_time: null,
        original_facility_id: null,
        booking_facilities: [{ facility_id: 'f1', facilities: { name: 'Gymnasium' } }],
      },
      error: null,
    }

    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/ask-reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'can you reschedule because of the event' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_booking_status', expect.objectContaining({
      p_new_status: 'awaiting_reschedule',
    }))
  })

  it('successfully handles an already awaiting_reschedule booking (e.g. displaced by event)', async () => {
    queryResult = {
      data: {
        id: BOOKING_UUID,
        user_id: USER_UUID,
        booking_reference: 'BK-20260814-001',
        current_status: 'awaiting_reschedule',
        booking_date: '2026-08-19',
        start_time: '12:30:00',
        end_time: '14:00:00',
        reschedule_deadline: '2026-08-17T17:09:00Z',
        original_date: '2026-08-19',
        original_start_time: '12:30:00',
        original_end_time: '14:00:00',
        original_facility_id: 'f1',
        booking_facilities: [{ facility_id: 'f1', facilities: { name: 'Gymnasium' } }],
      },
      error: null,
    }

    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/ask-reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'can you reschedule because of the event' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('rejects an invalid booking status like cancelled', async () => {
    queryResult = {
      data: {
        id: BOOKING_UUID,
        user_id: USER_UUID,
        booking_reference: 'BK-20260814-001',
        current_status: 'cancelled',
        booking_date: '2026-08-19',
        start_time: '12:30:00',
        end_time: '14:00:00',
        booking_facilities: [],
      },
      error: null,
    }

    const req = new NextRequest(`http://localhost:3000/api/admin/building/bookings/${BOOKING_UUID}/ask-reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'reschedule please' }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: BOOKING_UUID }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('not eligible')
  })
})
