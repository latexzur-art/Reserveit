import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { mockAcademicHeadUser, mockFacultyUser } from '../../mocks/auth'

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth/guards', () => ({
  requireAuthenticatedUser: (...args: any[]) => mockRequireAuth(...args),
}))

const mockSupabase = {
  from: vi.fn(),
}
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockSupabase,
}))

vi.mock('@/lib/errors', () => ({
  sanitizeDbError: (e: any) => e?.message ?? 'DB error',
}))

vi.mock('@/backend/booking', () => ({
  getFacilityAvailability: vi.fn(),
}))

import { GET } from '@/app/api/facilities/route'
import { GET as GETAvailability } from '@/app/api/facilities/[id]/availability/route'
import { getFacilityAvailability } from '@/backend/booking'
import { cacheDeleteByPrefix } from '@/lib/cache'

const mockGetAvailability = vi.mocked(getFacilityAvailability)

function makeChain(result: { data: any; error: any }) {
  const chain: any = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (resolve: any) => resolve(result),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  return chain
}

describe('GET /api/facilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cacheDeleteByPrefix('ref:')
  })

  it('should return 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    })

    const res = await GET(new NextRequest('http://localhost:3000/api/facilities'))
    expect(res.status).toBe(401)
  })

  it('should return active/bookable facilities by default', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser })
    const chain = makeChain({ data: [{ id: 'f1', name: 'Room A' }], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const res = await GET(new NextRequest('http://localhost:3000/api/facilities'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.facilities).toHaveLength(1)
    // Should apply active/bookable filters
    expect(chain.eq).toHaveBeenCalledWith('is_active', true)
    expect(chain.eq).toHaveBeenCalledWith('is_bookable', true)
    expect(chain.eq).toHaveBeenCalledWith('status', 'available')
  })

  it('should return all facilities when all=true for admin users', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser })
    const chain = makeChain({ data: [{ id: 'f1' }, { id: 'f2' }], error: null })
    mockSupabase.from.mockReturnValue(chain)

    const res = await GET(new NextRequest('http://localhost:3000/api/facilities?all=true'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.facilities).toHaveLength(2)
  })

  it('should return 403 when non-admin requests all=true', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser })

    const res = await GET(new NextRequest('http://localhost:3000/api/facilities?all=true'))
    expect(res.status).toBe(403)
  })

  it('should return 500 on database error', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser })
    const chain = makeChain({ data: null, error: { message: 'Connection failed' } })
    mockSupabase.from.mockReturnValue(chain)

    const res = await GET(new NextRequest('http://localhost:3000/api/facilities'))
    expect(res.status).toBe(500)
  })
})

describe('GET /api/facilities/[id]/availability', () => {
  const params = Promise.resolve({ id: 'facility-001' })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    })

    const req = new NextRequest('http://localhost:3000/api/facilities/x/availability?date=2026-04-01')
    const res = await GETAvailability(req, { params })
    expect(res.status).toBe(401)
  })

  it('should return 400 for missing date', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser })

    const req = new NextRequest('http://localhost:3000/api/facilities/x/availability')
    const res = await GETAvailability(req, { params })
    expect(res.status).toBe(400)
  })

  it('should return 400 for invalid date format', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser })

    const req = new NextRequest('http://localhost:3000/api/facilities/x/availability?date=april-first')
    const res = await GETAvailability(req, { params })
    expect(res.status).toBe(400)
  })

  it('should return availability data for valid request', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockFacultyUser })
    mockGetAvailability.mockResolvedValue({ slots: [], facility: { id: 'f1' } } as any)

    const req = new NextRequest('http://localhost:3000/api/facilities/x/availability?date=2026-04-01')
    const res = await GETAvailability(req, { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.facility.id).toBe('f1')
  })
})
