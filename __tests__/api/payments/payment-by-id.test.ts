import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFacultyUser, mockBuildingAdminUser, mockProgramHeadUser, mockAuthGuard } from '../../mocks/auth'

// Default authenticated user is a faculty member who owns the fixture payment
// below (payment.user_id === mockFacultyUser.id). Individual tests override
// requireAuthenticatedUser via mockResolvedValueOnce for the admin/forbidden cases.
vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))

// mockSingle must be created inside vi.hoisted() — vi.mock factories are
// hoisted above regular const declarations, so referencing a plain top-level
// const inside the '@/lib/supabase/server' factory below would TDZ-crash.
const { mockSingle } = vi.hoisted(() => ({ mockSingle: vi.fn() }))

const mockSupabase: any = {
  from: () => ({ select: () => ({ eq: () => ({ single: mockSingle }) }) }),
}
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))

import { GET } from '@/app/api/payments/[id]/route'
import { requireAuthenticatedUser } from '@/lib/auth/guards'

const VALID_PAYMENT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

function basePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_PAYMENT_ID,
    payment_reference: 'PAY-1',
    amount: 500,
    total_amount: 500,
    payment_status: 'pending_review',
    user_id: mockFacultyUser.id,
    qr_payer_name: 'Jane',
    qr_reference_number: 'REF-1',
    booking: { booking_reference: 'BK-1' },
    ...overrides,
  }
}

function mockRequest() {
  return new Request(`http://x/api/payments/${VALID_PAYMENT_ID}`)
}

describe('GET /api/payments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({ data: basePayment(), error: null })
  })

  it('allows a building admin to read any payment', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValueOnce({ error: null, user: mockBuildingAdminUser as any })
    mockSingle.mockResolvedValueOnce({ data: basePayment({ user_id: 'some-other-user' }), error: null })

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    expect(res.status).toBe(200)
  })

  it('allows the payment owner to read their own payment', async () => {
    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.payment.id).toBe(VALID_PAYMENT_ID)
    expect(body.payment.booking.booking_reference).toBe('BK-1')
  })

  it('forbids a non-owner, non-admin user from reading the payment', async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValueOnce({ error: null, user: mockProgramHeadUser as any })
    // basePayment().user_id belongs to mockFacultyUser, not mockProgramHeadUser.

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 when the payment does not exist', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'no rows' } })

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    expect(res.status).toBe(404)
  })

  it('rejects an invalid (non-UUID) payment id', async () => {
    const res = await GET(mockRequest(), { params: Promise.resolve({ id: 'not-a-uuid' }) })
    expect(res.status).toBe(400)
    expect(mockSingle).not.toHaveBeenCalled()
  })

  it('returns 500 when an unexpected Supabase exception occurs', async () => {
    mockSingle.mockRejectedValueOnce(new Error('Unexpected database error'))

    const res = await GET(mockRequest(), { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBeDefined()
  })
})
