import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAcademicHeadUser, mockFacultyUser } from '../../mocks/auth'

// Mock modules before importing the route
vi.mock('@/lib/auth/guards', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/bookings/check-conflict', () => ({
  checkBookingConflict: vi.fn().mockResolvedValue({ conflict: false }),
}))

import { POST } from '@/app/api/academic-head/propose-changes/route'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

const mockRequireAuth = vi.mocked(requireAuthenticatedUser)
const mockCreateAdmin = vi.mocked(createAdminClient)

function makeRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/academic-head/propose-changes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const FACILITY_UUID = '660e8400-e29b-41d4-a716-446655440000'

describe('POST /api/academic-head/propose-changes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await POST(makeRequest({
      booking_id: VALID_UUID,
      reason: 'Need to reschedule this booking',
      proposed_date: '2026-04-15',
    }))
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not academic_head', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser as any })

    const res = await POST(makeRequest({
      booking_id: VALID_UUID,
      reason: 'Need to reschedule this booking',
      proposed_date: '2026-04-15',
    }))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('academic_head')
  })

  it('should return 400 for invalid JSON body', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const req = new NextRequest('http://localhost:3000/api/academic-head/propose-changes', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid JSON body')
  })

  it('should return 400 when no changes are provided', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const res = await POST(makeRequest({
      booking_id: VALID_UUID,
      reason: 'Need to reschedule this booking',
      // No proposed_date, proposed_start_time, proposed_end_time, or proposed_facility_id
    }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('should return 404 when booking not found', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      })),
      rpc: vi.fn(),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: VALID_UUID,
      reason: 'Need to reschedule this booking',
      proposed_date: '2026-04-15',
    }))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('Booking not found')
  })

  it('should return 400 for non-proposable booking status', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: VALID_UUID,
            user_id: 'u1',
            booking_reference: 'REF-001',
            current_status: 'cancelled',
            booking_date: '2026-04-01',
            start_time: '09:00',
            end_time: '10:00',
            booking_facilities: [{ facility_id: FACILITY_UUID }],
          },
          error: null,
        }),
      })),
      rpc: vi.fn(),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: VALID_UUID,
      reason: 'Need to reschedule this booking',
      proposed_date: '2026-04-15',
    }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Cannot propose changes')
  })

  it('should successfully propose a date change', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockBooking = {
      id: VALID_UUID,
      user_id: 'u1',
      booking_reference: 'REF-001',
      current_status: 'pending',
      booking_date: '2026-04-01',
      start_time: '09:00',
      end_time: '10:00',
      booking_facilities: [{ facility_id: FACILITY_UUID }],
    }

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'booking_overrides') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'override-001' }, error: null }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
        }
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: VALID_UUID,
      reason: 'Need to reschedule this booking',
      proposed_date: '2026-04-15',
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.message).toContain('Change proposal sent')
    expect(data.override_id).toBe('override-001')
  })

  it('should successfully propose a facility change', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const newFacilityUuid = '770e8400-e29b-41d4-a716-446655440000'

    const mockBooking = {
      id: VALID_UUID,
      user_id: 'u1',
      booking_reference: 'REF-002',
      current_status: 'flagged',
      booking_date: '2026-04-01',
      start_time: '09:00',
      end_time: '10:00',
      booking_facilities: [{ facility_id: FACILITY_UUID }],
    }

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'facilities') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: newFacilityUuid, name: 'Room 202' }, error: null }),
          }
        }
        if (table === 'booking_overrides') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'override-002' }, error: null }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
        }
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: VALID_UUID,
      reason: 'Moving to a larger room for the class',
      proposed_facility_id: newFacilityUuid,
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.override_id).toBe('override-002')
  })

  it('should return 500 on database error', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockBooking = {
      id: VALID_UUID,
      user_id: 'u1',
      booking_reference: 'REF-001',
      current_status: 'pending',
      booking_date: '2026-04-01',
      start_time: '09:00',
      end_time: '10:00',
      booking_facilities: [{ facility_id: FACILITY_UUID }],
    }

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'booking_overrides') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB insert failed' } }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
        }
      }),
      rpc: vi.fn(),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: VALID_UUID,
      reason: 'Need to reschedule this booking',
      proposed_date: '2026-04-15',
    }))
    expect(res.status).toBe(500)
  })
})
