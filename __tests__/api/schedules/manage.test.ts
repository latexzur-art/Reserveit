import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  mockAcademicHeadUser,
  mockScheduleAuthGuard,
  authResultUser,
} from '../../mocks/auth'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth/guards', () =>
  mockScheduleAuthGuard(mockAcademicHeadUser)
)

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { PATCH, DELETE } from '@/app/api/schedules/manage/[scheduleId]/route'
import { POST as rollbackSchedules } from '@/app/api/schedules/history/rollback/route'
import { POST as deleteDrafts } from '@/app/api/schedules/history/drafts/delete/route'
import { POST as publishDrafts } from '@/app/api/schedules/history/drafts/publish/route'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

const mockCreateAdmin = vi.mocked(createAdminClient)
const mockRequireAcademicHead = vi.mocked(requireAcademicHeadOrBuildingAdmin)

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: any) {
  const opts: ConstructorParameters<typeof NextRequest>[1] = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  return new NextRequest(url, opts)
}

function chainableMock(resolvedValue: { data: any; error: any }) {
  const chain: any = {}
  const methods = [
    'select', 'eq', 'in', 'not', 'is', 'or', 'order', 'limit',
    'range', 'single', 'insert', 'update', 'delete', 'maybeSingle',
  ]
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockResolvedValue(resolvedValue)
  Object.defineProperty(chain, 'then', {
    value: (resolve: any, reject: any) => Promise.resolve(resolvedValue).then(resolve, reject),
    writable: true,
  })
  return chain
}

// ── PATCH /api/schedules/manage/[scheduleId] ─────────────────────────────────

describe('PATCH /api/schedules/manage/[scheduleId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should create a new version and supersede the original', async () => {
    const original = {
      id: 'sched-1',
      schedule_upload_id: 'up1',
      staging_entry_id: 'se1',
      academic_term_id: 'at1',
      department_id: 'dept-1',
      facility_id: 'fac-1',
      course_code: 'CS101',
      course_name: 'Intro CS',
      section: 'A',
      instructor_id: null,
      instructor_name: 'Dr. Smith',
      day_of_week: 1,
      start_time: '08:00',
      end_time: '09:00',
      effective_start_date: '2026-01-01',
      effective_end_date: '2026-05-31',
      version: 1,
    }
    const newSchedule = { ...original, id: 'sched-2', version: 2, course_name: 'Intro to CS' }

    let callIdx = 0
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        // Fetch original
        return chainableMock({ data: original, error: null })
      }
      if (callIdx === 2) {
        // Insert new version
        return chainableMock({ data: newSchedule, error: null })
      }
      // Update original (supersede)
      return chainableMock({ data: null, error: null })
    })
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    const res = await PATCH(
      makeRequest('PATCH', 'http://localhost/api/schedules/manage/sched-1', { course_name: 'Intro to CS' }),
      { params: Promise.resolve({ scheduleId: 'sched-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.schedule.id).toBe('sched-2')
    expect(json.schedule.version).toBe(2)
  })

  it('should return 500 when original not found', async () => {
    const chain = chainableMock({ data: null, error: { message: 'not found' } })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await PATCH(
      makeRequest('PATCH', 'http://localhost/api/schedules/manage/bad-id', { course_name: 'X' }),
      { params: Promise.resolve({ scheduleId: 'bad-id' }) }
    )
    expect(res.status).toBe(500)
  })
})

// ── DELETE /api/schedules/manage/[scheduleId] ────────────────────────────────

describe('DELETE /api/schedules/manage/[scheduleId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should soft-delete a schedule', async () => {
    const chain = chainableMock({ data: null, error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await DELETE(
      makeRequest('DELETE', 'http://localhost/api/schedules/manage/sched-1'),
      { params: Promise.resolve({ scheduleId: 'sched-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('should return 500 on database error', async () => {
    const chain = chainableMock({ data: null, error: { message: 'DB fail' } })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await DELETE(
      makeRequest('DELETE', 'http://localhost/api/schedules/manage/sched-1'),
      { params: Promise.resolve({ scheduleId: 'sched-1' }) }
    )
    expect(res.status).toBe(500)
  })
})

// ── POST /api/schedules/history/rollback ─────────────────────────────────────

describe('POST /api/schedules/history/rollback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAcademicHead.mockResolvedValue({ error: null, user: authResultUser(mockAcademicHeadUser) })
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
    mockRequireAcademicHead.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await rollbackSchedules(
      makeRequest('POST', 'http://localhost/api/schedules/history/rollback', { scheduleIds: ['s1'] })
    )
    expect(res.status).toBe(401)
  })

  it('should return 400 when scheduleIds is missing', async () => {
    const chain = chainableMock({ data: null, error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await rollbackSchedules(
      makeRequest('POST', 'http://localhost/api/schedules/history/rollback', {})
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Schedule IDs are required')
  })

  it('should return 400 when scheduleIds is an empty array', async () => {
    const chain = chainableMock({ data: null, error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await rollbackSchedules(
      makeRequest('POST', 'http://localhost/api/schedules/history/rollback', { scheduleIds: [] })
    )
    expect(res.status).toBe(400)
  })

  it('should return 404 when no schedules found', async () => {
    const chain = chainableMock({ data: [], error: null })
    Object.defineProperty(chain, 'then', {
      value: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
      writable: true,
    })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await rollbackSchedules(
      makeRequest('POST', 'http://localhost/api/schedules/history/rollback', { scheduleIds: ['s1'] })
    )
    expect(res.status).toBe(404)
  })

  it('should rollback schedules successfully', async () => {
    const schedules = [
      { id: 's1', staging_entry_id: 'se1' },
      { id: 's2', staging_entry_id: 'se2' },
    ]

    let callIdx = 0
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        // Fetch schedules
        const c = chainableMock({ data: schedules, error: null })
        return c
      }
      // delete + update staging
      return chainableMock({ data: null, error: null })
    })
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    const res = await rollbackSchedules(
      makeRequest('POST', 'http://localhost/api/schedules/history/rollback', { scheduleIds: ['s1', 's2'] })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.count).toBe(2)
  })
})

// ── POST /api/schedules/history/drafts/delete ────────────────────────────────

describe('POST /api/schedules/history/drafts/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAcademicHead.mockResolvedValue({ error: null, user: authResultUser(mockAcademicHeadUser) })
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
    mockRequireAcademicHead.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await deleteDrafts(
      makeRequest('POST', 'http://localhost/api/schedules/history/drafts/delete', { stagingIds: ['st1'] })
    )
    expect(res.status).toBe(401)
  })

  it('should return 400 when stagingIds is missing', async () => {
    const chain = chainableMock({ data: null, error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await deleteDrafts(
      makeRequest('POST', 'http://localhost/api/schedules/history/drafts/delete', {})
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Staging IDs are required')
  })

  it('should return 400 when stagingIds is empty', async () => {
    const chain = chainableMock({ data: null, error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await deleteDrafts(
      makeRequest('POST', 'http://localhost/api/schedules/history/drafts/delete', { stagingIds: [] })
    )
    expect(res.status).toBe(400)
  })

  it('should delete drafts successfully', async () => {
    const chain = chainableMock({ data: null, error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await deleteDrafts(
      makeRequest('POST', 'http://localhost/api/schedules/history/drafts/delete', { stagingIds: ['st1', 'st2'] })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.count).toBe(2)
  })

  it('should return 500 on database error', async () => {
    const chain = chainableMock({ data: null, error: { message: 'Delete failed' } })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await deleteDrafts(
      makeRequest('POST', 'http://localhost/api/schedules/history/drafts/delete', { stagingIds: ['st1'] })
    )
    expect(res.status).toBe(500)
  })
})

// ── POST /api/schedules/history/drafts/publish ───────────────────────────────

describe('POST /api/schedules/history/drafts/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAcademicHead.mockResolvedValue({ error: null, user: authResultUser(mockAcademicHeadUser) })
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
    mockRequireAcademicHead.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await publishDrafts(
      makeRequest('POST', 'http://localhost/api/schedules/history/drafts/publish', { stagingIds: ['st1'] })
    )
    expect(res.status).toBe(401)
  })

  it('should return 400 when stagingIds is missing', async () => {
    const chain = chainableMock({ data: null, error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await publishDrafts(
      makeRequest('POST', 'http://localhost/api/schedules/history/drafts/publish', {})
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Staging IDs are required')
  })

  it('should return 404 when no staging entries found', async () => {
    const chain = chainableMock({ data: [], error: null })
    Object.defineProperty(chain, 'then', {
      value: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
      writable: true,
    })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await publishDrafts(
      makeRequest('POST', 'http://localhost/api/schedules/history/drafts/publish', { stagingIds: ['st1'] })
    )
    expect(res.status).toBe(404)
  })

  it('should return 400 when entries have validation errors', async () => {
    const entries = [
      {
        id: 'st1',
        course_code: 'CS101',
        validation_status: 'error',
        facility_id: 'fac-1',
        schedule_uploads: { academic_term_id: 'at1', department_id: 'd1', batch_effective_date: '2026-01-01', batch_effective_end_date: '2026-05-31' },
      },
    ]
    const chain = chainableMock({ data: entries, error: null })
    Object.defineProperty(chain, 'then', {
      value: (resolve: any, reject: any) => Promise.resolve({ data: entries, error: null }).then(resolve, reject),
      writable: true,
    })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await publishDrafts(
      makeRequest('POST', 'http://localhost/api/schedules/history/drafts/publish', { stagingIds: ['st1'] })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('validation errors')
  })

  it('should publish valid entries and return count', async () => {
    const entries = [
      {
        id: 'st1',
        course_code: 'CS101',
        course_name: 'Intro CS',
        section: 'A',
        instructor_id: null,
        instructor_name: 'Dr. Smith',
        facility_id: 'fac-1',
        day_of_week: 1,
        start_time: '08:00',
        end_time: '09:00',
        effective_start_date: null,
        effective_end_date: null,
        schedule_upload_id: 'up1',
        validation_status: 'valid',
        schedule_uploads: {
          academic_term_id: 'at1',
          department_id: 'd1',
          batch_effective_date: '2026-01-01',
          batch_effective_end_date: '2026-05-31',
        },
      },
    ]

    let callIdx = 0
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        // Fetch staging entries
        const c = chainableMock({ data: entries, error: null })
        return c
      }
      // Insert class_schedule + update staging entry
      return chainableMock({ data: { id: 'cs-new' }, error: null })
    })
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    const res = await publishDrafts(
      makeRequest('POST', 'http://localhost/api/schedules/history/drafts/publish', { stagingIds: ['st1'] })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.count).toBe(1)
  })
})
