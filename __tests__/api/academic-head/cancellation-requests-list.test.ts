import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAcademicHeadUser, mockAuthGuard } from '../../mocks/auth'
import { requireAuthenticatedUser } from '@/lib/auth/guards'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockAcademicHeadUser))

let queryResult: any = { data: null, error: null }
const mockSupabase: any = {}
const chainMethods = ['from', 'select', 'eq', 'order', 'is'] as const
for (const method of chainMethods) {
  mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
}

mockSupabase.then = function (resolve: any, reject?: any) {
  return Promise.resolve(queryResult).then(resolve, reject)
}

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockSupabase,
}))

function makeRequest(url: string) {
  return new Request(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /api/academic-head/cancellation-requests', () => {
  let GET: any

  beforeEach(async () => {
    vi.clearAllMocks()
    for (const method of chainMethods) {
      mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
    }
    queryResult = { data: null, error: null }

    const mod = await import('@/app/api/academic-head/cancellation-requests/route')
    GET = mod.GET
  })

  it('should require academic_head role', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(requireAuthenticatedUser).mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null as any,
    })

    const res = await GET(makeRequest('http://localhost:3000/api/academic-head/cancellation-requests'))
    expect(res.status).toBe(401)
  })

  it('should return 403 if not academic_head role', async () => {
    const { requireAuthenticatedUser } = await import('@/lib/auth/guards')
    vi.mocked(requireAuthenticatedUser).mockResolvedValueOnce({
      error: null,
      user: { roles: [{ name: 'faculty' }] } as any,
    })

    const res = await GET(makeRequest('http://localhost:3000/api/academic-head/cancellation-requests'))
    expect(res.status).toBe(403)
  })

  it('should default to status=pending when no query param given', async () => {
    queryResult = {
      data: [
        {
          id: 'cr-1',
          booking_id: 'bk-1',
          user_id: 'u-1',
          reason: 'Schedule conflict',
          status: 'pending',
          original_status: 'approved',
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
          auto_approved: false,
          refund_window_met: true,
          refund_destination_name: 'Credit Card',
          refund_destination_contact_number: null,
          created_at: '2026-08-12T10:00:00Z',
          users: { full_name: 'John Doe', email: 'john@example.com' },
          bookings: {
            booking_reference: 'BK-001',
            booking_date: '2026-08-15',
            start_time: '09:00',
            end_time: '11:00',
            current_status: 'cancellation_requested',
            booking_facilities: [{ facility_id: 'f-1', facilities: { name: 'Room 101' } }],
          },
        },
      ],
      error: null,
    }

    const res = await GET(makeRequest('http://localhost:3000/api/academic-head/cancellation-requests'))
    expect(res.status).toBe(200)
    expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'pending')

    const body = await res.json()
    expect(body.requests).toHaveLength(1)
    expect(body.requests[0].refund_window_met).toBe(true)
    expect(body.requests[0].refund_destination_name).toBe('Credit Card')
  })

  it('should NOT filter by status when status=all is passed', async () => {
    queryResult = { data: [], error: null }

    const res = await GET(makeRequest('http://localhost:3000/api/academic-head/cancellation-requests?status=all'))
    expect(res.status).toBe(200)

    // eq() should not be called at all when status=all
    expect(mockSupabase.eq).not.toHaveBeenCalledWith('status', 'all')
  })

  it('should filter by custom status when query param provided', async () => {
    queryResult = { data: [], error: null }

    const res = await GET(makeRequest('http://localhost:3000/api/academic-head/cancellation-requests?status=approved_no_strike'))
    expect(res.status).toBe(200)
    expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'approved_no_strike')
  })

  it('should return requests shape with refund fields on success', async () => {
    queryResult = {
      data: [
        {
          id: 'cr-1',
          booking_id: 'bk-1',
          user_id: 'u-1',
          reason: 'Schedule conflict',
          status: 'pending',
          original_status: 'approved',
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
          auto_approved: false,
          refund_window_met: true,
          refund_destination_name: 'Bank Transfer',
          refund_destination_contact_number: '+639001234567',
          created_at: '2026-08-12T10:00:00Z',
          users: { full_name: 'Jane Smith', email: 'jane@example.com' },
          bookings: {
            booking_reference: 'BK-002',
            booking_date: '2026-08-20',
            start_time: '14:00',
            end_time: '16:00',
            current_status: 'cancellation_requested',
            booking_facilities: [{ facility_id: 'f-2', facilities: { name: 'Auditorium' } }],
          },
        },
        {
          id: 'cr-2',
          booking_id: 'bk-2',
          user_id: 'u-2',
          reason: 'Health issue',
          status: 'pending',
          original_status: 'approved',
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
          auto_approved: true,
          refund_window_met: false,
          refund_destination_name: null,
          refund_destination_contact_number: null,
          created_at: '2026-08-11T15:30:00Z',
          users: { full_name: 'Bob Johnson', email: 'bob@example.com' },
          bookings: {
            booking_reference: 'BK-003',
            booking_date: '2026-08-18',
            start_time: '10:00',
            end_time: '12:00',
            current_status: 'cancellation_requested',
            booking_facilities: [{ facility_id: 'f-3', facilities: { name: 'Lab' } }],
          },
        },
      ],
      error: null,
    }

    const res = await GET(makeRequest('http://localhost:3000/api/academic-head/cancellation-requests'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.requests).toHaveLength(2)

    // Check first request has all refund fields
    expect(body.requests[0]).toMatchObject({
      id: 'cr-1',
      refund_window_met: true,
      refund_destination_name: 'Bank Transfer',
      refund_destination_contact_number: '+639001234567',
    })

    // Check second request refund fields
    expect(body.requests[1]).toMatchObject({
      id: 'cr-2',
      refund_window_met: false,
      refund_destination_name: null,
      refund_destination_contact_number: null,
    })
  })

  it('should return empty array on query error', async () => {
    queryResult = {
      data: null,
      error: { message: 'Database error' },
    }

    const res = await GET(makeRequest('http://localhost:3000/api/academic-head/cancellation-requests'))
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error).toBe('Failed to fetch requests')
  })

  it('should order results by created_at descending', async () => {
    queryResult = { data: [], error: null }

    await GET(makeRequest('http://localhost:3000/api/academic-head/cancellation-requests'))

    expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})
