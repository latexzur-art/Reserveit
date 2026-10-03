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

import { POST } from '@/app/api/academic-head/review-booking/route'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

const mockRequireAuth = vi.mocked(requireAuthenticatedUser)
const mockCreateAdmin = vi.mocked(createAdminClient)

function makeRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/academic-head/review-booking', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/academic-head/review-booking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await POST(makeRequest({ booking_id: '123', action: 'approve', reason: 'looks good to me' }))
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not academic_head', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser as any })

    const res = await POST(makeRequest({ booking_id: '123', action: 'approve', reason: 'looks good to me' }))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('academic_head')
  })

  it('should return 400 for invalid JSON body', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const req = new NextRequest('http://localhost:3000/api/academic-head/review-booking', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('should return 400 for invalid payload (missing fields)', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const res = await POST(makeRequest({ booking_id: 'not-a-uuid' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('should return 400 for reason too short', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const res = await POST(makeRequest({
      booking_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'approve',
      reason: 'short',
    }))
    expect(res.status).toBe(400)
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
      booking_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'approve',
      reason: 'This booking looks good to me',
    }))
    expect(res.status).toBe(404)
  })

  it('should return 400 for non-reviewable booking status (cancelled)', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'b1', user_id: 'u1', booking_reference: 'REF-001', current_status: 'cancelled' },
          error: null,
        }),
      })),
      rpc: vi.fn(),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'approve',
      reason: 'This booking looks good to me',
    }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Cannot review')
  })

  it('should return idempotent 200 when re-approving an already-approved booking (P0-3)', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const rpcMock = vi.fn()
    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'b1', user_id: 'u1', booking_reference: 'REF-001', current_status: 'approved' },
          error: null,
        }),
      })),
      rpc: rpcMock,
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'approve',
      reason: 'This booking looks good to me',
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.idempotent).toBe(true)
    // No status-history insert — no side effects on retry.
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('should return 409 when reject is requested but booking already approved (P0-3)', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'b1', user_id: 'u1', booking_reference: 'REF-001', current_status: 'approved' },
          error: null,
        }),
      })),
      rpc: vi.fn(),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'reject',
      reason: 'Actually this should not have been approved',
    }))
    expect(res.status).toBe(409)
  })

  it('should approve a pending booking successfully', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockBooking = {
      id: '550e8400-e29b-41d4-a716-446655440000',
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
      })),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'approve',
      reason: 'This booking looks good to me',
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.message).toContain('approved')
  })

  it('should reject a flagged booking successfully', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockBooking = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: 'u1',
      booking_reference: 'REF-002',
      current_status: 'flagged',
    }

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
        insert: vi.fn().mockReturnThis(),
      })),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await POST(makeRequest({
      booking_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'reject',
      reason: 'This booking conflicts with scheduled events',
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.message).toContain('rejected')
  })
})
