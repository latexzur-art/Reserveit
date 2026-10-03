import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFacultyUser, mockAuthGuard } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))

const { mockMaybeSingle } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
}))

const mockSupabase: any = {
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: mockMaybeSingle,
      }),
    }),
  }),
}
vi.mock('@/lib/supabase/server', () => ({ createClient: () => Promise.resolve(mockSupabase) }))

import { GET } from '@/app/api/payments/[id]/refund/route'
import { requireAuthenticatedUser } from '@/lib/auth/guards'

const VALID_PAYMENT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

function mockRequest() {
  return new Request(`http://x/api/payments/${VALID_PAYMENT_ID}/refund`)
}

describe('GET /api/payments/[id]/refund', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires authentication', async () => {
    const { NextResponse } = await import('next/server')
    vi.mocked(requireAuthenticatedUser).mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null as any,
    })

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    expect(res.status).toBe(401)
    // The route must short-circuit before touching Supabase at all.
    expect(mockMaybeSingle).not.toHaveBeenCalled()
  })

  it('rejects an invalid (non-UUID) payment id', async () => {
    const res = await GET(mockRequest(), { params: Promise.resolve({ id: 'not-a-uuid' }) })
    expect(res.status).toBe(400)
    expect(mockMaybeSingle).not.toHaveBeenCalled()
  })

  it('returns 404 when no payment_refunds row exists for the payment', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 with refund data when recorded_by_user comes back as a plain object', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        amount: 500,
        reference_number: 'REF-1',
        screenshot_url: 'https://x/shot.png',
        destination_name: 'Jane',
        destination_contact_number: '0917',
        recorded_at: '2026-08-01T00:00:00Z',
        trigger_type: 'ba_override',
        justification_note: 'phone arrangement',
        recorded_by_user: { full_name: 'Jane BA' },
      },
      error: null,
    })

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.refund).toEqual({
      amount: 500,
      reference_number: 'REF-1',
      screenshot_url: 'https://x/shot.png',
      destination_name: 'Jane',
      destination_contact_number: '0917',
      destination_qr_url: null,
      recorded_at: '2026-08-01T00:00:00Z',
      trigger_type: 'ba_override',
      justification_note: 'phone arrangement',
      recorded_by_name: 'Jane BA',
    })
  })

  it('unwraps recorded_by_user and returns 200 when Supabase returns it as an array', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        amount: 250,
        reference_number: 'REF-2',
        screenshot_url: null,
        destination_name: 'Alex',
        destination_contact_number: '0918',
        recorded_at: '2026-08-02T00:00:00Z',
        trigger_type: 'cancellation_request_entitlement',
        justification_note: null,
        recorded_by_user: [{ full_name: 'Alex BA' }],
      },
      error: null,
    })

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.refund.recorded_by_name).toBe('Alex BA')
  })

  it('falls back to "Building Admin" when recorded_by_user is missing', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        amount: 100,
        reference_number: 'REF-3',
        screenshot_url: null,
        destination_name: 'X',
        destination_contact_number: '0919',
        recorded_at: '2026-08-03T00:00:00Z',
        trigger_type: 'ba_override',
        justification_note: null,
        recorded_by_user: null,
      },
      error: null,
    })

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.refund.recorded_by_name).toBe('Building Admin')
  })

  it('returns 500 when the Supabase query errors', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'db exploded' } })

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    expect(res.status).toBe(500)
  })
})
