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
  sendNotificationToRoles: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '@/app/api/academic-head/cancel-booking/route'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

const mockRequireAuth = vi.mocked(requireAuthenticatedUser)
const mockCreateAdmin = vi.mocked(createAdminClient)

function makeRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/academic-head/cancel-booking', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('POST /api/academic-head/cancel-booking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await POST(makeRequest({ booking_id: VALID_UUID, reason: 'This is a valid cancellation reason' }))
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not academic_head', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser as any })

    const res = await POST(makeRequest({ booking_id: VALID_UUID, reason: 'This is a valid cancellation reason' }))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('academic_head')
  })

  it('should return 400 for invalid JSON body', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const req = new NextRequest('http://localhost:3000/api/academic-head/cancel-booking', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid JSON body')
  })

  it('should return 400 for validation failure (reason too short)', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const res = await POST(makeRequest({ booking_id: VALID_UUID, reason: 'short' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Validation failed')
    expect(data.issues).toBeDefined()
  })

  it('should return 400 for validation failure (invalid UUID)', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const res = await POST(makeRequest({ booking_id: 'not-a-uuid', reason: 'This is a valid cancellation reason' }))
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
      reason: 'This booking needs to be cancelled due to scheduling conflict',
    }))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('Booking not found')
  })

  it('should return 400 for non-cancellable booking status', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: VALID_UUID, user_id: 'u1', booking_reference: 'REF-001', current_status: 'cancelled' },
          error: null,
        }),
      })),
      rpc: vi.fn(),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: VALID_UUID,
      reason: 'This booking needs to be cancelled due to scheduling conflict',
    }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Cannot cancel')
  })

  it('should cancel a pending booking successfully', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockBooking = {
      id: VALID_UUID,
      user_id: 'u1',
      booking_reference: 'REF-001',
      current_status: 'pending',
    }

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
      })),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: VALID_UUID,
      reason: 'This booking needs to be cancelled due to scheduling conflict',
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.message).toContain('cancelled')
    expect(data.booking_id).toBe(VALID_UUID)
  })

  it('should return 500 on database error', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockBooking = {
      id: VALID_UUID,
      user_id: 'u1',
      booking_reference: 'REF-001',
      current_status: 'approved',
    }

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
      })),
      rpc: vi.fn().mockResolvedValue({ error: { message: 'DB connection failed' } }),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: VALID_UUID,
      reason: 'This booking needs to be cancelled due to scheduling conflict',
    }))
    expect(res.status).toBe(500)
  })
})
