import { describe, it, expect, vi } from 'vitest'
import { mockFacultyUser, mockAuthGuard } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))
const mockSupabase: any = {}
;['from', 'select', 'eq', 'order', 'limit'].forEach(m => { mockSupabase[m] = vi.fn().mockReturnValue(mockSupabase) })
mockSupabase.then = (resolve: any) => Promise.resolve({ data: [{ id: 'cr-1', status: 'pending' }], error: null }).then(resolve)
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))

import { GET } from '@/app/api/bookings/my-cancellation-requests/route'

describe('GET /api/bookings/my-cancellation-requests', () => {
  it('scopes to the caller own requests', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', mockFacultyUser.id)
  })

  it('returns the requests array from the query', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.requests).toEqual([{ id: 'cr-1', status: 'pending' }])
  })
})
