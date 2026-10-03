import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockFacultyUser, mockAuthGuard } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))

// Separate mock results for each query
let bookingQueryResult: any = { data: [], error: null }
let blockQueryResult: any = { data: [], error: null }

function createChain(table: string) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    then: (resolve: any, reject?: any) => {
      const result = table === 'facility_blocks' ? blockQueryResult : bookingQueryResult
      return Promise.resolve(result).then(resolve, reject)
    },
  }
  return chain
}

const mockSupabase: any = {
  from: vi.fn((table: string) => createChain(table)),
}

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockSupabase,
}))

function makeRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('GET /api/facilities/[id]/booked-dates', () => {
  let GET: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockSupabase.from = vi.fn((table: string) => createChain(table))
    bookingQueryResult = { data: [], error: null }
    blockQueryResult = { data: [], error: null }
    const mod = await import('@/app/api/facilities/[id]/booked-dates/route')
    GET = mod.GET
  })

const mockParams = { params: Promise.resolve({ id: 'f1' }) }

  it('returns 400 for missing month param', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/facilities/f1/booked-dates'), mockParams)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid month format', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/facilities/f1/booked-dates?month=2026'), mockParams)
    expect(res.status).toBe(400)
  })

  it('returns empty dates when no bookings or blocks exist', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/facilities/f1/booked-dates?month=2026-08'), mockParams)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.bookedDates).toEqual([])
  })

  it('returns dates with active bookings', async () => {
    bookingQueryResult = {
      data: [
        { bookings: { booking_date: '2026-08-15' } },
        { bookings: { booking_date: '2026-08-20' } },
      ],
      error: null,
    }

    const res = await GET(makeRequest('http://localhost:3000/api/facilities/f1/booked-dates?month=2026-08'), mockParams)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.bookedDates).toEqual(expect.arrayContaining(['2026-08-15', '2026-08-20']))
  })

  it('deduplicates dates from multiple bookings on same day', async () => {
    bookingQueryResult = {
      data: [
        { bookings: { booking_date: '2026-08-15' } },
        { bookings: { booking_date: '2026-08-15' } },
      ],
      error: null,
    }

    const res = await GET(makeRequest('http://localhost:3000/api/facilities/f1/booked-dates?month=2026-08'), mockParams)
    const body = await res.json()
    expect(body.bookedDates.filter((d: string) => d === '2026-08-15')).toHaveLength(1)
  })

  it('returns dates from facility blocks spanning multiple days', async () => {
    blockQueryResult = {
      data: [{
        start_time: '2026-08-10T08:00:00Z',
        end_time: '2026-08-12T17:00:00Z',
      }],
      error: null,
    }

    const res = await GET(makeRequest('http://localhost:3000/api/facilities/f1/booked-dates?month=2026-08'), mockParams)
    const body = await res.json()
    expect(body.bookedDates).toEqual(expect.arrayContaining(['2026-08-10', '2026-08-11', '2026-08-12']))
  })

  it('combines dates from bookings and blocks', async () => {
    bookingQueryResult = {
      data: [{ bookings: { booking_date: '2026-08-15' } }],
      error: null,
    }
    blockQueryResult = {
      data: [{
        start_time: '2026-08-20T08:00:00Z',
        end_time: '2026-08-20T17:00:00Z',
      }],
      error: null,
    }

    const res = await GET(makeRequest('http://localhost:3000/api/facilities/f1/booked-dates?month=2026-08'), mockParams)
    const body = await res.json()
    expect(body.bookedDates).toEqual(expect.arrayContaining(['2026-08-15', '2026-08-20']))
  })

  it('returns 500 on query error', async () => {
    bookingQueryResult = { data: null, error: { message: 'DB error' } }

    const res = await GET(makeRequest('http://localhost:3000/api/facilities/f1/booked-dates?month=2026-08'), mockParams)
    expect(res.status).toBe(500)
  })
})
