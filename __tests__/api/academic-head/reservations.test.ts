import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAcademicHeadUser, mockFacultyUser } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

import { GET } from '@/app/api/academic-head/reservations/route'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

const mockRequireAuth = vi.mocked(requireAuthenticatedUser)
const mockCreateAdmin = vi.mocked(createAdminClient)

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/academic-head/reservations')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /api/academic-head/reservations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('should return 403 for non-academic_head user', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser as any })

    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('should return reservations for academic_head user', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockBookings = [
      {
        id: 'b1',
        booking_reference: 'REF-001',
        booking_date: '2026-04-01',
        start_time: '09:00:00',
        end_time: '10:00:00',
        current_status: 'pending',
        booking_purpose: 'academic',
        purpose: 'Lecture',
        event_name: null,
        expected_attendees: 30,
        decision_score: null,
        created_at: '2026-03-25T00:00:00Z',
        mismatch_flag: null,
        users: { id: 'u1', full_name: 'Prof Smith', email: 'smith@test.com', departments: { id: 'd1', name: 'CS', code: 'CS' } },
        booking_facilities: [{ facility: { id: 'f1', name: 'Room 101', room_number: '101', floors: { floor_number: 1, buildings: { name: 'Main' } } } }],
      },
    ]

    const mockSupabase: any = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (res: any) => {
            if (table === 'bookings') {
              return Promise.resolve({ data: mockBookings, count: 1, error: null }).then(res)
            }
            if (table === 'departments') {
              return Promise.resolve({ data: [{ id: 'd1', code: 'CS', name: 'Computer Science' }], error: null }).then(res)
            }
            return Promise.resolve({ data: [], error: null }).then(res)
          },
        }
        return chain
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase)

    const res = await GET(makeRequest({ page: '1', pageSize: '20' }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.bookings).toBeDefined()
    expect(Array.isArray(data.bookings)).toBe(true)
  })
})
