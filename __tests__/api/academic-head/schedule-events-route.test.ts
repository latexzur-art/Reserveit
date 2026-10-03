import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAcademicHeadUser, mockBuildingAdminUser } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => ({
  requireAcademicHeadOrBuildingAdmin: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({ rpc: vi.fn().mockResolvedValue({ data: null, error: null }) })),
}))
vi.mock('@/backend/schedule-events/scheduleEventGroupActions', () => ({
  createGroup: vi.fn(),
}))
vi.mock('@/backend/schedule-events/getScheduleEventGroups', () => ({
  getScheduleEventGroups: vi.fn().mockResolvedValue([]),
}))

import { POST, GET } from '@/app/api/academic-head/schedule-events/route'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { createGroup } from '@/backend/schedule-events/scheduleEventGroupActions'
import { getScheduleEventGroups } from '@/backend/schedule-events/getScheduleEventGroups'

const mockRequireAuth = vi.mocked(requireAcademicHeadOrBuildingAdmin)
const mockCreateGroup = vi.mocked(createGroup)
const mockGetGroups = vi.mocked(getScheduleEventGroups)

function makePostRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/academic-head/schedule-events', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/academic-head/schedule-events (rewritten)', () => {
  it('400 when event_name is missing', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockBuildingAdminUser as any })
    const res = await POST(makePostRequest({ dates: ['2026-09-01'], facility_ids: ['fac-1'] }))
    expect(res.status).toBe(400)
  })

  it('400 when no facilities specified (neither facility_ids nor all_facilities)', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockBuildingAdminUser as any })
    const res = await POST(makePostRequest({ event_name: 'X', dates: ['2026-09-01'] }))
    expect(res.status).toBe(400)
  })

  it('400 when no dates specified', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockBuildingAdminUser as any })
    const res = await POST(makePostRequest({ event_name: 'X', facility_ids: ['fac-1'] }))
    expect(res.status).toBe(400)
  })

  it('expands legacy start_date/end_date into dates[] before delegating', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockBuildingAdminUser as any })
    mockCreateGroup.mockResolvedValue({ group_id: 'g1', bookingsVoided: 0, schedulesVoided: 0, eventsCount: 3, status: 'auto_approved' })

    const res = await POST(
      makePostRequest({
        event_name: 'Founders Week',
        start_date: '2026-09-01',
        end_date: '2026-09-03',
        start_time: '08:00',
        end_time: '17:00',
        facility_ids: ['fac-1'],
      })
    )

    expect(res.status).toBe(200)
    expect(mockCreateGroup).toHaveBeenCalledTimes(1)
    const params = mockCreateGroup.mock.calls[0][1]
    expect(params.dates).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  it('determines actorRole from the real session, not a client-supplied field, and 200s with the group result shape', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })
    mockCreateGroup.mockResolvedValue({ group_id: 'g2', bookingsVoided: 0, schedulesVoided: 0, eventsCount: 1, status: 'pending' })

    const res = await POST(
      makePostRequest({
        event_name: 'Exam Block',
        dates: ['2026-09-01'],
        all_facilities: true,
        actorRole: 'building_admin', // client-supplied -- must be ignored
      })
    )

    expect(res.status).toBe(200)
    const params = mockCreateGroup.mock.calls[0][1]
    expect(params.actorRole).toBe('academic_head')
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.group_id).toBe('g2')
    expect(data.status).toBe('pending')
  })
})

describe('GET /api/academic-head/schedule-events (rewritten)', () => {
  it('returns the grouped shape with publicView: false and passes through filter params', async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: mockBuildingAdminUser as any })
    mockGetGroups.mockResolvedValue([{ group_id: 'g1', event_name: 'X', block_category: 'school_event', current_status: 'auto_approved', dates: ['2026-09-01'], facilities: [], booking_ids: ['b1'], created_by_name: 'Someone' }])

    const req = new NextRequest('http://localhost:3000/api/academic-head/schedule-events?status=auto_approved&block_category=exam_period')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.events).toHaveLength(1)
    expect(mockGetGroups).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'auto_approved', block_category: 'exam_period' }),
      { publicView: false }
    )
  })
})
