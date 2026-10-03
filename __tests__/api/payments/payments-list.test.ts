import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFacultyUser, mockAuthGuard } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))

function buildQueryable(result: { data: unknown; error: unknown }) {
  const q: any = {}
  ;['from', 'select', 'order', 'eq'].forEach(m => { q[m] = vi.fn().mockReturnValue(q) })
  q.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return q
}

const queryable = buildQueryable({
  data: [{
    id: 'p-1', payment_method: 'qr_manual', payment_status: 'pending_review',
    qr_reference_number: 'REF-1', qr_review_notes: null,
    qr_payer_name: 'Jane Renter', qr_payer_contact_number: '09171234567',
  }],
  error: null,
})
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => queryable }))

import { GET } from '@/app/api/payments/route'

describe('GET /api/payments', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('selects the qr_* proof/review columns so the client can render QR payment state', async () => {
    const req = new Request('http://x/api/payments')
    await GET(req as any)
    const selectArg = queryable.select.mock.calls[0][0] as string
    expect(selectArg).toContain('qr_reference_number')
    expect(selectArg).toContain('qr_review_notes')
    expect(selectArg).toContain('qr_payer_name')
    expect(selectArg).toContain('qr_payer_contact_number')
  })

  it('returns qr_reference_number and qr_review_notes on each payment', async () => {
    const req = new Request('http://x/api/payments')
    const res = await GET(req as any)
    const body = await res.json()
    expect(body.payments[0].qr_reference_number).toBe('REF-1')
    expect(body.payments[0].qr_payer_name).toBe('Jane Renter')
  })
})
