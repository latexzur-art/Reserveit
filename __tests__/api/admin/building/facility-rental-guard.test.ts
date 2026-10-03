import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))

const FACILITY_ID = 'fac-001-aaaa-bbbb-cccc-dddd'

// ── Supabase mock ──────────────────────────────────────────────────────────
const { mockSupabase } = vi.hoisted(() => {
  const mockSupabase: any = {}
  return { mockSupabase }
})

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))

// We need to mock BuildingPricingService.toggleFacilityRental so the route
// can still call it after our guard passes. We'll build per-test `from()` chains.

import { PUT } from '@/app/api/admin/building/facilities/[id]/rental/route'

/**
 * Build a `supabase.from()` mock that returns the given `rentalRatesRows`
 * for the first `.from('rental_rates')` call, then delegates the second
 * `.from('facilities')` call to the given `facilitiesChain`.
 */
function buildFromMock(rentalRatesRows: any[] | null, rentalRatesError: any = null, facilitiesChain?: any) {
  let callIndex = 0
  return (table: string) => {
    if (table === 'rental_rates') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: rentalRatesRows, error: rentalRatesError }),
              }),
            }),
          }),
        }),
      }
    }
    // facilities — used by toggleFacilityRental (blind UPDATE)
    return facilitiesChain ?? {
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
    }
  }
}

function makeReq(isAvailableForRental: boolean) {
  return new NextRequest('http://localhost/api/admin/building/facilities/fac-001/rental', {
    method: 'PUT',
    body: JSON.stringify({ isAvailableForRental }),
  })
}

describe('PUT /api/admin/building/facilities/[id]/rental — rental rate guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 with no_rates_configured when toggling ON with no active rates and no inactive rates', async () => {
    // First call (active rates) → empty; second call (inactive rates check) → empty
    let callCount = 0
    mockSupabase.from = (table: string) => {
      if (table === 'rental_rates') {
        callCount++
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }
      }
      return { update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }
    }

    // We need to also handle the second query for inactive rates (no limit, no is_addon filter)
    // Let's build a smarter mock that handles both queries
    let rentalRateQueryCount = 0
    mockSupabase.from = (table: string) => {
      if (table === 'rental_rates') {
        rentalRateQueryCount++
        if (rentalRateQueryCount === 1) {
          // Active rates check (with limit(1))
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    limit: () => Promise.resolve({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }
        }
        // Inactive rates check (without limit)
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      return { update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }
    }

    const res = await PUT(makeReq(true), { params: Promise.resolve({ id: FACILITY_ID }) })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('no_rates_configured')
    expect(body.message).toContain('no rental rates')
  })

  it('returns 400 with inactive_rates_exist when toggling ON with only inactive rates', async () => {
    let rentalRateQueryCount = 0
    mockSupabase.from = (table: string) => {
      if (table === 'rental_rates') {
        rentalRateQueryCount++
        if (rentalRateQueryCount === 1) {
          // Active rates check → empty
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    limit: () => Promise.resolve({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }
        }
        // Inactive rates check → found 2
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({
                  data: [
                    { id: 'rate-1', rate_name: 'AM Rate' },
                    { id: 'rate-2', rate_name: 'PM Rate' },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      return { update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }
    }

    const res = await PUT(makeReq(true), { params: Promise.resolve({ id: FACILITY_ID }) })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('inactive_rates_exist')
    expect(body.inactive_rates).toHaveLength(2)
    expect(body.message).toContain('inactive rate')
  })

  it('succeeds when toggling ON with active rates', async () => {
    mockSupabase.from = (table: string) => {
      if (table === 'rental_rates') {
        // Active rates check → found 1
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => Promise.resolve({ data: [{ id: 'rate-1' }], error: null }),
                }),
              }),
            }),
          }),
        }
      }
      // facilities UPDATE
      return {
        update: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
      }
    }

    const res = await PUT(makeReq(true), { params: Promise.resolve({ id: FACILITY_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.isAvailableForRental).toBe(true)
  })

  it('succeeds when toggling OFF (no rate check needed)', async () => {
    mockSupabase.from = (table: string) => {
      // Should NOT query rental_rates for OFF toggle
      if (table === 'rental_rates') {
        throw new Error('Should not query rental_rates when toggling OFF')
      }
      return {
        update: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
      }
    }

    const res = await PUT(makeReq(false), { params: Promise.resolve({ id: FACILITY_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.isAvailableForRental).toBe(false)
  })

  it('returns 400 when isAvailableForRental is not a boolean', async () => {
    const req = new NextRequest('http://localhost/api/admin/building/facilities/fac-001/rental', {
      method: 'PUT',
      body: JSON.stringify({ isAvailableForRental: 'yes' }),
    })

    const res = await PUT(req, { params: Promise.resolve({ id: FACILITY_ID }) })
    expect(res.status).toBe(400)
  })
})
