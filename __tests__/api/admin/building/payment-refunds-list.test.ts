import { describe, it, expect, vi } from 'vitest'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))
const mockSupabase: any = {}
;['from', 'select', 'order', 'eq', 'gte', 'lte', 'range'].forEach(m => { mockSupabase[m] = vi.fn().mockReturnValue(mockSupabase) })
mockSupabase.then = (resolve: any) => Promise.resolve({ data: [{ amount: 500 }, { amount: 250 }], error: null }).then(resolve)
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))

import { GET } from '@/app/api/admin/building/payment-refunds/route'

describe('GET /api/admin/building/payment-refunds', () => {
  it('returns the total amount refunded across the filtered set', async () => {
    const req = new (await import('next/server')).NextRequest('http://x/api/admin/building/payment-refunds')
    const res = await GET(req)
    const body = await res.json()
    expect(body.totalAmount).toBe(750)
  })

  it('caps pageSize at 50 even if a larger value is requested', async () => {
    const req = new (await import('next/server')).NextRequest('http://x/api/admin/building/payment-refunds?pageSize=500')
    await GET(req)
    expect(mockSupabase.range).toHaveBeenCalledWith(0, 49)
  })
})
