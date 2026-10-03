import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockFacultyUser } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => ({
  requireAuthenticatedUser: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({})),
}))
vi.mock('@/backend/schedule-events/getScheduleEventGroups', () => ({
  getScheduleEventGroups: vi.fn(),
}))

import { GET } from '@/app/api/schedule-events/upcoming/route'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { getScheduleEventGroups } from '@/backend/schedule-events/getScheduleEventGroups'

const mockAuth = vi.mocked(requireAuthenticatedUser)
const mockGetGroups = vi.mocked(getScheduleEventGroups)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/schedule-events/upcoming', () => {
  it('401s when unauthenticated', async () => {
    const unauth = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockAuth.mockResolvedValue({ error: unauth as any, user: null as any })
    const res = await GET(new NextRequest('http://localhost:3000/api/schedule-events/upcoming'))
    expect(res.status).toBe(401)
  })

  it('200s for any authenticated role, with booking_ids/created_by_name absent from every group', async () => {
    mockAuth.mockResolvedValue({ error: null, user: mockFacultyUser as any })
    mockGetGroups.mockResolvedValue([
      { group_id: 'g1', event_name: 'Finals', block_category: 'exam_period', current_status: 'auto_approved', dates: ['2026-10-01'], facilities: [] },
    ])

    const res = await GET(new NextRequest('http://localhost:3000/api/schedule-events/upcoming'))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.events).toHaveLength(1)
    expect(data.events[0].booking_ids).toBeUndefined()
    expect(data.events[0].created_by_name).toBeUndefined()
    expect(mockGetGroups).toHaveBeenCalledWith(expect.anything(), expect.any(Object), { publicView: true })
  })

  it('passes through the same filter params as the privileged endpoint', async () => {
    mockAuth.mockResolvedValue({ error: null, user: mockFacultyUser as any })
    mockGetGroups.mockResolvedValue([])

    const req = new NextRequest('http://localhost:3000/api/schedule-events/upcoming?status=pending&block_category=school_event&facility_id=fac-1&start_date=2026-01-01&end_date=2026-02-01')
    await GET(req)

    expect(mockGetGroups).toHaveBeenCalledWith(
      expect.anything(),
      { status: 'pending', block_category: 'school_event', facility_id: 'fac-1', start_date: '2026-01-01', end_date: '2026-02-01' },
      { publicView: true }
    )
  })
})
