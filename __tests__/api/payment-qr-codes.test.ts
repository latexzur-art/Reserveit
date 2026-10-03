import { describe, it, expect, vi } from 'vitest'
import { mockFacultyUser, mockAuthGuard } from '../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))
vi.mock('@/backend/payments/qrCodeService', () => ({ QrCodeService: { listActive: vi.fn().mockResolvedValue([{ id: 'qc-1', label: 'GCash' }]) } }))

const mockSupabase: any = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [{ key: 'payment_helpdesk_contact', value: '0912-345-6789' }] }),
    }),
  }),
}
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))

import { GET } from '@/app/api/payment-qr-codes/route'

describe('GET /api/payment-qr-codes', () => {
  it('returns only active codes to any authenticated user', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.qrCodes).toHaveLength(1)
  })

  it('includes the renter-facing helpdesk contact so QrPaymentPanel can render it', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.helpdeskContact).toBe('0912-345-6789')
  })
})
