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

import { GET as getHistory } from '@/app/api/schedules/history/route'
import { GET as getChangelog } from '@/app/api/schedules/changelog/route'
import { POST as rollbackUpload } from '@/app/api/schedules/review/[uploadId]/rollback/route'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

const mockCreateAdmin = vi.mocked(createAdminClient)
const mockRequireAcademicHead = vi.mocked(requireAcademicHeadOrBuildingAdmin)

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest(url: string) {
  return new NextRequest(url, { method: 'GET' })
}

function makePostRequest(url: string, body: any) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Build a chainable Supabase query mock that resolves with data/error. */
function chainableMock(resolvedValue: { data: any; error: any }) {
  const chain: any = {}
  const methods = [
    'select', 'eq', 'in', 'not', 'is', 'or', 'order', 'limit',
    'range', 'single', 'insert', 'update', 'delete', 'maybeSingle',
  ]
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  // Terminal calls resolve
  chain.single = vi.fn().mockResolvedValue(resolvedValue)
  chain.then = (res: any) => Promise.resolve(resolvedValue).then(res)
  // Make the chain itself thenable so `await query` works
  Object.defineProperty(chain, 'then', {
    value: (resolve: any, reject: any) => Promise.resolve(resolvedValue).then(resolve, reject),
    writable: true,
  })
  return chain
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/schedules/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return uploads list on success', async () => {
    const uploads = [
      { id: 'u1', upload_status: 'submitted', source_file_name: 'sched.csv' },
      { id: 'u2', upload_status: 'approved', source_file_name: 'sched2.csv' },
    ]
    const chain = chainableMock({ data: uploads, error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await getHistory(makeGetRequest('http://localhost/api/schedules/history'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.uploads).toHaveLength(2)
  })

  it('should pass status filter to query', async () => {
    const chain = chainableMock({ data: [], error: null })
    const fromFn = vi.fn().mockReturnValue(chain)
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    await getHistory(makeGetRequest('http://localhost/api/schedules/history?status=submitted'))
    expect(chain.eq).toHaveBeenCalledWith('upload_status', 'submitted')
  })

  it('should pass department_id filter to query', async () => {
    const chain = chainableMock({ data: [], error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    await getHistory(makeGetRequest('http://localhost/api/schedules/history?department_id=dept-001'))
    expect(chain.eq).toHaveBeenCalledWith('department_id', 'dept-001')
  })

  it('should return 500 on database error', async () => {
    const chain = chainableMock({ data: null, error: { message: 'DB Error' } })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await getHistory(makeGetRequest('http://localhost/api/schedules/history'))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('DB Error')
  })
})

describe('GET /api/schedules/changelog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return modifications and deletions on success', async () => {
    const modifications = [
      { id: 's1', course_code: 'CS101', superseded_by: 's2' },
    ]
    const deletions = [
      { id: 's3', course_code: 'CS201', is_active: false, superseded_by: null },
    ]

    const newVersion = { id: 's2', course_code: 'CS101', version: 2 }

    let callCount = 0
    const fromFn = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // modifications query
        return chainableMock({ data: modifications, error: null })
      }
      if (callCount === 2) {
        // new version lookup for each modification
        const c = chainableMock({ data: newVersion, error: null })
        return c
      }
      // deletions query
      return chainableMock({ data: deletions, error: null })
    })

    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    const res = await getChangelog()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.modifications).toHaveLength(1)
    expect(json.modifications[0].original.course_code).toBe('CS101')
    expect(json.deletions).toHaveLength(1)
  })

  it('should return 500 when modifications query fails', async () => {
    const chain = chainableMock({ data: null, error: { message: 'Query failed' } })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await getChangelog()
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Query failed')
  })
})

describe('POST /api/schedules/review/[uploadId]/rollback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to authenticated user
    mockRequireAcademicHead.mockResolvedValue({ error: null, user: authResultUser(mockAcademicHeadUser) })
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
    mockRequireAcademicHead.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await rollbackUpload(
      makePostRequest('http://localhost/api/schedules/review/upload-1/rollback', { entryIds: ['e1'] }),
      { params: Promise.resolve({ uploadId: 'upload-1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('should return 400 when entryIds is missing or not an array', async () => {
    const chain = chainableMock({ data: [], error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await rollbackUpload(
      makePostRequest('http://localhost/api/schedules/review/upload-1/rollback', { entryIds: 'not-array' }),
      { params: Promise.resolve({ uploadId: 'upload-1' }) }
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Entry IDs are required')
  })

  it('should return 404 when no active schedules found', async () => {
    const chain = chainableMock({ data: [], error: null })
    // Override thenable so `await query` returns { data: [], error: null }
    Object.defineProperty(chain, 'then', {
      value: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
      writable: true,
    })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await rollbackUpload(
      makePostRequest('http://localhost/api/schedules/review/upload-1/rollback', { entryIds: ['e1'] }),
      { params: Promise.resolve({ uploadId: 'upload-1' }) }
    )
    expect(res.status).toBe(404)
  })

  it('should rollback successfully and return count', async () => {
    const schedules = [
      { id: 'cs1', staging_entry_id: 'e1' },
      { id: 'cs2', staging_entry_id: 'e2' },
    ]

    let callIdx = 0
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        // Fetch class_schedules matching staging entries
        const c = chainableMock({ data: schedules, error: null })
        return c
      }
      // All subsequent calls (delete, update, select upload status, update upload)
      const c = chainableMock({ data: { upload_status: 'approved' }, error: null })
      return c
    })

    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    const res = await rollbackUpload(
      makePostRequest('http://localhost/api/schedules/review/upload-1/rollback', { entryIds: ['e1', 'e2'] }),
      { params: Promise.resolve({ uploadId: 'upload-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.count).toBe(2)
  })
})
