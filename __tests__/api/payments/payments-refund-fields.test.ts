import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockFacultyUser, mockAuthGuard } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))

// Chainable + thenable mock matching this route's actual query shape:
// supabase.from('payments').select(...).order('created_at', ...).eq('user_id', ...)
// (the trailing .eq() only runs for non-admin viewers / scope=self — mockFacultyUser
// is not an admin viewer, so the route always appends it here).
let queryResult: { data: any[]; error: any } = { data: [], error: null }

const mockSupabase: any = {}
for (const method of ['from', 'select', 'order', 'eq'] as const) {
  mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
}
mockSupabase.then = function (resolve: any, reject?: any) {
  return Promise.resolve(queryResult).then(resolve, reject)
}

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockSupabase,
}))

import { GET } from '@/app/api/payments/route'

function makeRequest(url = 'http://localhost:3000/api/payments') {
  return new NextRequest(url)
}

describe('GET /api/payments — refund field', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const method of ['from', 'select', 'order', 'eq'] as const) {
      mockSupabase[method] = vi.fn().mockImplementation(() => mockSupabase)
    }
    queryResult = { data: [], error: null }
  })

  it('embeds refund evidence when a payment_refunds row exists', async () => {
    queryResult = {
      data: [
        {
          id: 'p-1',
          user_id: mockFacultyUser.id,
          payment_status: 'refunded',
          booking: { id: 'b-1', booking_reference: 'BK-1' },
          payment_refunds: [
            {
              amount: 823.5,
              reference_number: 'REF-9-PERSISTED',
              destination_name: 'GCash - Jane Doe Refund',
              recorded_at: '2026-08-10T00:00:00.000Z',
            },
          ],
        },
      ],
      error: null,
    }

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.payments).toHaveLength(1)
    expect(body.payments[0].refund).toEqual({
      amount: 823.5,
      reference_number: 'REF-9-PERSISTED',
      destination_name: 'GCash - Jane Doe Refund',
      recorded_at: '2026-08-10T00:00:00.000Z',
    })
    // The raw join array should not leak into the shaped response.
    expect(body.payments[0].payment_refunds).toBeUndefined()
  })

  it('returns refund: null when no payment_refunds row exists', async () => {
    queryResult = {
      data: [
        {
          id: 'p-2',
          user_id: mockFacultyUser.id,
          payment_status: 'paid',
          booking: { id: 'b-2', booking_reference: 'BK-2' },
          payment_refunds: [],
        },
      ],
      error: null,
    }

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.payments).toHaveLength(1)
    expect(body.payments[0].refund).toBeNull()
  })

  it('handles a missing payment_refunds key gracefully (defensive, non-array case)', async () => {
    queryResult = {
      data: [
        {
          id: 'p-3',
          user_id: mockFacultyUser.id,
          payment_status: 'pending',
          booking: { id: 'b-3', booking_reference: 'BK-3' },
        },
      ],
      error: null,
    }

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.payments[0].refund).toBeNull()
  })
})
