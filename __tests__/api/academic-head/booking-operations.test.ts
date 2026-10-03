import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAcademicHeadUser, mockFacultyUser } from '../../mocks/auth'

// Mock modules before importing the routes
vi.mock('@/lib/auth/guards', () => ({
  requireAuthenticatedUser: vi.fn(),
  requireAcademicHead: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/backend/booking', () => ({
  checkTimeSlotAvailability: vi.fn(),
}))

import { GET as getAvailableFacilities } from '@/app/api/academic-head/available-facilities/route'
import { GET as getUsersList } from '@/app/api/academic-head/users-list/route'
import { DELETE as deleteBooking } from '@/app/api/academic-head/bookings/[id]/route'
import { POST as bulkDeleteBookings } from '@/app/api/academic-head/bookings/bulk-delete/route'
import { requireAuthenticatedUser, requireAcademicHead } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { checkTimeSlotAvailability } from '@/backend/booking'

const mockRequireAuth = vi.mocked(requireAuthenticatedUser)
const mockRequireAcademicHead = vi.mocked(requireAcademicHead)
const mockCreateAdmin = vi.mocked(createAdminClient)
const mockCheckAvailability = vi.mocked(checkTimeSlotAvailability)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

// ─── available-facilities ────────────────────────────────────────────────────

describe('GET /api/academic-head/available-facilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeRequest(params: Record<string, string> = {}) {
    const url = new URL('http://localhost:3000/api/academic-head/available-facilities')
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    return new NextRequest(url.toString(), { method: 'GET' })
  }

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await getAvailableFacilities(makeRequest({ date: '2026-04-15', start_time: '09:00', end_time: '10:00' }))
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not academic_head', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser as any })

    const res = await getAvailableFacilities(makeRequest({ date: '2026-04-15', start_time: '09:00', end_time: '10:00' }))
    expect(res.status).toBe(403)
  })

  it('should return 400 when date is missing', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const res = await getAvailableFacilities(makeRequest({ start_time: '09:00', end_time: '10:00' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('date')
  })

  it('should return 400 when start_time is missing', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const res = await getAvailableFacilities(makeRequest({ date: '2026-04-15', end_time: '10:00' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('start_time')
  })

  it('should return 400 when end_time is missing', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const res = await getAvailableFacilities(makeRequest({ date: '2026-04-15', start_time: '09:00' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('end_time')
  })

  it('should return facilities with availability status', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockFacilities = [
      { id: 'f1', name: 'Room 101', room_number: '101', is_active: true, status: 'available', floors: { floor_number: 1, buildings: { name: 'Main Building' } } },
      { id: 'f2', name: 'Room 202', room_number: '202', is_active: true, status: 'available', floors: { floor_number: 2, buildings: { name: 'Main Building' } } },
    ]

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockFacilities, error: null }),
      })),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    mockCheckAvailability
      .mockResolvedValueOnce({ available: true, conflicts: [] } as any)
      .mockResolvedValueOnce({ available: false, conflicts: ['Conflicting booking'] } as any)

    const res = await getAvailableFacilities(makeRequest({ date: '2026-04-15', start_time: '09:00', end_time: '10:00' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.facilities).toHaveLength(2)
    expect(data.facilities[0].is_available).toBe(true)
    expect(data.facilities[1].is_available).toBe(false)
    expect(data.facilities[1].conflict_reason).toBe('Conflicting booking')
  })

  it('should return 500 on database error', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      })),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await getAvailableFacilities(makeRequest({ date: '2026-04-15', start_time: '09:00', end_time: '10:00' }))
    expect(res.status).toBe(500)
  })
})

// ─── users-list ──────────────────────────────────────────────────────────────

describe('GET /api/academic-head/users-list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeRequest(params: Record<string, string> = {}) {
    const url = new URL('http://localhost:3000/api/academic-head/users-list')
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    return new NextRequest(url.toString(), { method: 'GET' })
  }

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAcademicHead.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await getUsersList(makeRequest())
    expect(res.status).toBe(401)
  })

  it('should return users list successfully', async () => {
    mockRequireAcademicHead.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockUsers = [
      { id: 'u1', full_name: 'Alice Smith', email: 'alice@test.com' },
      { id: 'u2', full_name: null, email: 'bob@test.com' },
    ]

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ data: mockUsers, error: null }),
        // When no search param, the query resolves from limit()
        then: undefined,
      })),
    }

    // The users-list route builds a query chain. When there's no search param,
    // the chain ends at .limit(100) then is awaited. We need the chain itself
    // to resolve when awaited.
    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      or: vi.fn(),
    }
    // Make limit return a thenable that resolves with data
    const awaitable = { data: mockUsers, error: null }
    chainable.limit.mockReturnValue({
      ...awaitable,
      or: vi.fn().mockResolvedValue(awaitable),
      then: (resolve: any) => resolve(awaitable),
    })

    const mockSupa = {
      from: vi.fn().mockReturnValue(chainable),
    }
    mockCreateAdmin.mockReturnValue(mockSupa as any)

    const res = await getUsersList(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.users).toBeDefined()
    expect(data.users).toHaveLength(2)
    expect(data.users[0].name).toBe('Alice Smith')
    expect(data.users[1].name).toBe('bob@test.com')
  })

  it('should return users list with search filter', async () => {
    mockRequireAcademicHead.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockUsers = [
      { id: 'u1', full_name: 'Alice Smith', email: 'alice@test.com' },
    ]

    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: mockUsers, error: null }),
    }

    const mockSupa = {
      from: vi.fn().mockReturnValue(chainable),
    }
    mockCreateAdmin.mockReturnValue(mockSupa as any)

    const res = await getUsersList(makeRequest({ search: 'alice' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.users).toHaveLength(1)
    expect(data.users[0].name).toBe('Alice Smith')
  })

  it('should return 500 on database error', async () => {
    mockRequireAcademicHead.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const chainable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    }
    chainable.limit.mockReturnValue({
      data: null,
      error: { message: 'DB error' },
      or: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      then: (resolve: any) => resolve({ data: null, error: { message: 'DB error' } }),
    })

    const mockSupa = {
      from: vi.fn().mockReturnValue(chainable),
    }
    mockCreateAdmin.mockReturnValue(mockSupa as any)

    const res = await getUsersList(makeRequest())
    expect(res.status).toBe(500)
  })
})

// ─── bookings/[id] DELETE ────────────────────────────────────────────────────

describe('DELETE /api/academic-head/bookings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeRequest() {
    return new NextRequest(`http://localhost:3000/api/academic-head/bookings/${VALID_UUID}`, {
      method: 'DELETE',
    })
  }

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await deleteBooking(makeRequest(), { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not academic_head', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser as any })

    const res = await deleteBooking(makeRequest(), { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(403)
  })

  it('should return 404 when booking not found', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      })),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await deleteBooking(makeRequest(), { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(404)
  })

  it('should return 400 for non-deletable booking status', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: VALID_UUID, current_status: 'pending', booking_reference: 'REF-001' },
          error: null,
        }),
      })),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await deleteBooking(makeRequest(), { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Cannot delete')
  })

  it('should successfully delete a cancelled booking', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: VALID_UUID, current_status: 'cancelled', booking_reference: 'REF-001' },
          error: null,
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await deleteBooking(makeRequest(), { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.booking_reference).toBe('REF-001')
  })

  it('should successfully delete a completed booking', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: VALID_UUID, current_status: 'completed', booking_reference: 'REF-002' },
          error: null,
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await deleteBooking(makeRequest(), { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})

// ─── bookings/bulk-delete ────────────────────────────────────────────────────

describe('POST /api/academic-head/bookings/bulk-delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeRequest(body: any) {
    return new NextRequest('http://localhost:3000/api/academic-head/bookings/bulk-delete', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await bulkDeleteBookings(makeRequest({ ids: [VALID_UUID] }))
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not academic_head', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser as any })

    const res = await bulkDeleteBookings(makeRequest({ ids: [VALID_UUID] }))
    expect(res.status).toBe(403)
  })

  it('should return 400 for invalid JSON body', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const req = new NextRequest('http://localhost:3000/api/academic-head/bookings/bulk-delete', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    })

    const res = await bulkDeleteBookings(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid JSON body')
  })

  it('should return 400 for empty ids array', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const res = await bulkDeleteBookings(makeRequest({ ids: [] }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('should return 400 for invalid UUID in ids', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const res = await bulkDeleteBookings(makeRequest({ ids: ['not-a-uuid'] }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('should successfully bulk delete bookings', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const uuid2 = '660e8400-e29b-41d4-a716-446655440000'

    // The route makes three DB calls in sequence:
    //   1. bookings.select('id').in('id', ids).in('current_status', ...) → find deletable IDs
    //   2. payments.delete().in('booking_id', deletableIds)             → remove FK-blocked payments
    //   3. bookings.delete({ count:'exact' }).in('id', deletableIds)    → delete bookings
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'bookings') {
          return {
            // call 1: select path
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ id: VALID_UUID }, { id: uuid2 }],
                  error: null,
                }),
              }),
            }),
            // call 3: delete bookings
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null, count: 2 }),
            }),
          }
        }
        // call 2: delete payments
        return {
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await bulkDeleteBookings(makeRequest({ ids: [VALID_UUID, uuid2] }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.deleted).toBe(2)
  })

  it('should return 500 on database error', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

    const mockSupabase = {
      from: vi.fn().mockImplementation(() => ({
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: { message: 'DB error' }, count: null }),
          }),
        }),
      })),
    }
    mockCreateAdmin.mockReturnValue(mockSupabase as any)

    const res = await bulkDeleteBookings(makeRequest({ ids: [VALID_UUID] }))
    expect(res.status).toBe(500)
  })
})
