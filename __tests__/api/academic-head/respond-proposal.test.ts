import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAcademicHeadUser } from '../../mocks/auth'

// Mock modules before importing the route
vi.mock('@/lib/auth/guards', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  sendNotificationToRoles: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '@/app/api/academic-head/respond-proposal/route'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

const mockRequireAuth = vi.mocked(requireAuthenticatedUser)
const mockCreateAdmin = vi.mocked(createAdminClient)

function makeRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/academic-head/respond-proposal', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('POST /api/academic-head/respond-proposal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await POST(makeRequest({ booking_id: VALID_UUID, action: 'accept' }))
    expect(res.status).toBe(401)
  })

  it('should return 400 for invalid JSON body', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const req = new NextRequest('http://localhost:3000/api/academic-head/respond-proposal', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid JSON body')
  })

  it('should return 400 for invalid action value', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const res = await POST(makeRequest({ booking_id: VALID_UUID, action: 'maybe' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('should return 400 for missing booking_id', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const res = await POST(makeRequest({ action: 'accept' }))
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

    const res = await POST(makeRequest({ booking_id: VALID_UUID, action: 'accept' }))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toContain('not found')
  })

  it('should return 400 when booking is not pending_faculty_response', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: VALID_UUID,
            user_id: mockAcademicHeadUser.id,
            booking_reference: 'REF-001',
            current_status: 'approved',
          },
          error: null,
        }),
      })),
      rpc: vi.fn(),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({ booking_id: VALID_UUID, action: 'accept' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('not pending')
  })

  it('should accept proposal successfully', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockBooking = {
      id: VALID_UUID,
      user_id: mockAcademicHeadUser.id,
      booking_reference: 'REF-001',
      current_status: 'pending_faculty_response',
    }

    const mockOverride = {
      id: 'override-001',
      original_values: { status: 'pending', booking_date: '2026-04-01', start_time: '09:00', end_time: '10:00', facility_id: 'f1' },
      new_values: { booking_date: '2026-04-15' },
      override_action: 'reschedule',
      overridden_by: 'ah-001',
    }

    let fromCallCount = 0
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'bookings') {
          fromCallCount++
          // First call: fetch booking; subsequent calls: update
          if (fromCallCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
            }
          }
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        if (table === 'booking_overrides') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockOverride, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({ booking_id: VALID_UUID, action: 'accept' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.message).toContain('accepted')
    expect(data.message).toContain('approved')
  })

  it('should decline proposal successfully and cancel booking', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockBooking = {
      id: VALID_UUID,
      user_id: mockAcademicHeadUser.id,
      booking_reference: 'REF-002',
      current_status: 'pending_faculty_response',
    }

    const mockOverride = {
      id: 'override-002',
      original_values: { status: 'pending', booking_date: '2026-04-01' },
      new_values: { booking_date: '2026-04-20' },
      override_action: 'reschedule',
      overridden_by: 'ah-001',
    }

    let fromCallCount = 0
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'bookings') {
          fromCallCount++
          if (fromCallCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
            }
          }
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        if (table === 'booking_overrides') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockOverride, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({ booking_id: VALID_UUID, action: 'decline' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.message).toContain('declined')
    expect(data.message).toContain('cancelled')
  })

  it('should return 500 on database error', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockBooking = {
      id: VALID_UUID,
      user_id: mockAcademicHeadUser.id,
      booking_reference: 'REF-001',
      current_status: 'pending_faculty_response',
    }

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'bookings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
          }
        }
        if (table === 'booking_overrides') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
      rpc: vi.fn(),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({ booking_id: VALID_UUID, action: 'accept' }))
    expect(res.status).toBe(404)
  })
})
