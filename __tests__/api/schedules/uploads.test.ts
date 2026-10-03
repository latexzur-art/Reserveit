import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  mockAcademicHeadUser,
  mockFacultyUser,
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

import { GET as getUpload, DELETE as deleteUpload } from '@/app/api/schedules/uploads/[id]/route'
import { GET as getEntries } from '@/app/api/schedules/uploads/[id]/entries/route'
import { requireAuthenticatedInternal } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

const mockCreateAdmin = vi.mocked(createAdminClient)
const mockRequireAuth = vi.mocked(requireAuthenticatedInternal)

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest(url: string) {
  return new NextRequest(url, { method: 'GET' })
}

function makeDeleteRequest(url: string) {
  return new NextRequest(url, { method: 'DELETE' })
}

function chainableMock(resolvedValue: { data: any; error: any; count?: number | null }) {
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
    value: (resolve: any, reject: any) =>
      Promise.resolve({
        data: resolvedValue.data,
        error: resolvedValue.error,
        count: resolvedValue.count ?? null,
      }).then(resolve, reject),
    writable: true,
  })
  return chain
}

// ── GET /api/schedules/uploads/[id] ──────────────────────────────────────────

describe('GET /api/schedules/uploads/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ error: null, user: authResultUser(mockAcademicHeadUser) })
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await getUpload(
      makeGetRequest('http://localhost/api/schedules/uploads/upload-1'),
      { params: Promise.resolve({ id: 'upload-1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('should return 404 when upload not found', async () => {
    const chain = chainableMock({ data: null, error: { message: 'not found' } })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await getUpload(
      makeGetRequest('http://localhost/api/schedules/uploads/550e8400-e29b-41d4-a716-446655440000'),
      { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) }
    )
    expect(res.status).toBe(404)
  })

  it('should return 403 when non-admin user is not the uploader', async () => {
    const facultyAuthResult = authResultUser(mockFacultyUser)
    mockRequireAuth.mockResolvedValue({ error: null, user: facultyAuthResult })

    const uploadData = {
      id: 'upload-1',
      uploaded_by: 'some-other-user-id',
      academic_terms: { id: 'at1', term_name: '1st Sem', school_year: '2025-2026', semester: '1' },
      departments: { id: 'd1', name: 'CS' },
      users: { id: 'other', full_name: 'Other User', email: 'other@test.com' },
    }
    const chain = chainableMock({ data: uploadData, error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await getUpload(
      makeGetRequest('http://localhost/api/schedules/uploads/550e8400-e29b-41d4-a716-446655440000'),
      { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) }
    )
    expect(res.status).toBe(403)
  })

  it('should return upload when user is academic_head', async () => {
    const uploadData = {
      id: 'upload-1',
      uploaded_by: 'some-other-user-id',
      source_file_name: 'sched.csv',
      academic_terms: { id: 'at1', term_name: '1st Sem', school_year: '2025-2026', semester: '1' },
      departments: { id: 'd1', name: 'CS' },
      users: { id: 'other', full_name: 'Other User', email: 'other@test.com' },
    }
    const chain = chainableMock({ data: uploadData, error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await getUpload(
      makeGetRequest('http://localhost/api/schedules/uploads/550e8400-e29b-41d4-a716-446655440000'),
      { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.upload.id).toBe('upload-1')
  })

  it('should return upload when user is the uploader', async () => {
    const facultyAuthResult = authResultUser(mockFacultyUser)
    mockRequireAuth.mockResolvedValue({ error: null, user: facultyAuthResult })

    const uploadData = {
      id: 'upload-1',
      uploaded_by: mockFacultyUser.id, // matches the faculty user id
      source_file_name: 'sched.csv',
      academic_terms: { id: 'at1', term_name: '1st Sem', school_year: '2025-2026', semester: '1' },
      departments: { id: 'd1', name: 'CS' },
      users: { id: mockFacultyUser.id, full_name: 'Test Faculty', email: 'faculty@test.com' },
    }
    const chain = chainableMock({ data: uploadData, error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await getUpload(
      makeGetRequest('http://localhost/api/schedules/uploads/550e8400-e29b-41d4-a716-446655440000'),
      { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) }
    )
    expect(res.status).toBe(200)
  })
})

// ── DELETE /api/schedules/uploads/[id] ───────────────────────────────────────

describe('DELETE /api/schedules/uploads/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ error: null, user: authResultUser(mockAcademicHeadUser) })
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await deleteUpload(
      makeDeleteRequest('http://localhost/api/schedules/uploads/upload-1'),
      { params: Promise.resolve({ id: 'upload-1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not an admin', async () => {
    const facultyAuthResult = authResultUser(mockFacultyUser)
    mockRequireAuth.mockResolvedValue({ error: null, user: facultyAuthResult })

    const res = await deleteUpload(
      makeDeleteRequest('http://localhost/api/schedules/uploads/upload-1'),
      { params: Promise.resolve({ id: 'upload-1' }) }
    )
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('Forbidden')
  })

  it('should return 404 when upload not found', async () => {
    const chain = chainableMock({ data: null, error: { message: 'not found' } })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await deleteUpload(
      makeDeleteRequest('http://localhost/api/schedules/uploads/bad-id'),
      { params: Promise.resolve({ id: 'bad-id' }) }
    )
    expect(res.status).toBe(404)
  })

  it('should delete upload successfully', async () => {
    let callIdx = 0
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        // Check upload exists
        return chainableMock({ data: { upload_status: 'submitted' }, error: null })
      }
      // Delete
      return chainableMock({ data: null, error: null })
    })
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    const res = await deleteUpload(
      makeDeleteRequest('http://localhost/api/schedules/uploads/upload-1'),
      { params: Promise.resolve({ id: 'upload-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it('should deactivate published schedules and delete an approved upload', async () => {
    // The route now soft-deletes active class_schedules + clears the publish log
    // before deleting the upload, so an approved upload deletes successfully.
    const fromFn = vi.fn().mockImplementation(() =>
      chainableMock({
        data: { upload_status: 'approved', department_id: 'd1', uploaded_by: mockAcademicHeadUser.id },
        error: null,
      })
    )
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    const res = await deleteUpload(
      makeDeleteRequest('http://localhost/api/schedules/uploads/upload-1'),
      { params: Promise.resolve({ id: 'upload-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})

// ── GET /api/schedules/uploads/[id]/entries ──────────────────────────────────

describe('GET /api/schedules/uploads/[id]/entries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ error: null, user: authResultUser(mockAcademicHeadUser) })
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
    mockRequireAuth.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await getEntries(
      makeGetRequest('http://localhost/api/schedules/uploads/upload-1/entries'),
      { params: Promise.resolve({ id: 'upload-1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('should return 404 when upload not found', async () => {
    const chain = chainableMock({ data: null, error: null })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await getEntries(
      makeGetRequest('http://localhost/api/schedules/uploads/upload-1/entries'),
      { params: Promise.resolve({ id: 'upload-1' }) }
    )
    expect(res.status).toBe(404)
  })

  it('should return 403 when non-admin user is not the uploader', async () => {
    const facultyAuthResult = authResultUser(mockFacultyUser)
    mockRequireAuth.mockResolvedValue({ error: null, user: facultyAuthResult })

    let callIdx = 0
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        // Check upload ownership
        return chainableMock({ data: { uploaded_by: 'some-other-user' }, error: null })
      }
      return chainableMock({ data: [], error: null, count: 0 })
    })
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    const res = await getEntries(
      makeGetRequest('http://localhost/api/schedules/uploads/upload-1/entries'),
      { params: Promise.resolve({ id: 'upload-1' }) }
    )
    expect(res.status).toBe(403)
  })

  it('should return paginated entries on success', async () => {
    const entries = [
      { id: 'e1', course_code: 'CS101', row_number: 1 },
      { id: 'e2', course_code: 'CS102', row_number: 2 },
    ]

    let callIdx = 0
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        // Check upload ownership
        return chainableMock({ data: { uploaded_by: mockAcademicHeadUser.id }, error: null })
      }
      // Entries query
      const c = chainableMock({ data: entries, error: null, count: 2 })
      return c
    })
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    const res = await getEntries(
      makeGetRequest('http://localhost/api/schedules/uploads/upload-1/entries'),
      { params: Promise.resolve({ id: 'upload-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.entries).toHaveLength(2)
    expect(json.total).toBe(2)
    expect(json.page).toBe(1)
    expect(json.page_size).toBe(50)
  })

  it('should filter by status when provided', async () => {
    let callIdx = 0
    const entriesChain = chainableMock({ data: [], error: null, count: 0 })
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        return chainableMock({ data: { uploaded_by: mockAcademicHeadUser.id }, error: null })
      }
      return entriesChain
    })
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    await getEntries(
      makeGetRequest('http://localhost/api/schedules/uploads/upload-1/entries?status=error'),
      { params: Promise.resolve({ id: 'upload-1' }) }
    )
    expect(entriesChain.eq).toHaveBeenCalledWith('validation_status', 'error')
  })

  it('should filter conflicts_only when provided', async () => {
    let callIdx = 0
    const entriesChain = chainableMock({ data: [], error: null, count: 0 })
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        return chainableMock({ data: { uploaded_by: mockAcademicHeadUser.id }, error: null })
      }
      return entriesChain
    })
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    await getEntries(
      makeGetRequest('http://localhost/api/schedules/uploads/upload-1/entries?conflicts_only=true'),
      { params: Promise.resolve({ id: 'upload-1' }) }
    )
    expect(entriesChain.or).toHaveBeenCalledWith('has_internal_conflict.eq.true,has_external_conflict.eq.true')
  })

  it('should return 500 on database error', async () => {
    let callIdx = 0
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        return chainableMock({ data: { uploaded_by: mockAcademicHeadUser.id }, error: null })
      }
      const c = chainableMock({ data: null, error: { message: 'Query failed' }, count: null })
      Object.defineProperty(c, 'then', {
        value: (resolve: any, reject: any) =>
          Promise.resolve({ data: null, error: { message: 'Query failed' }, count: null }).then(resolve, reject),
        writable: true,
      })
      return c
    })
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    const res = await getEntries(
      makeGetRequest('http://localhost/api/schedules/uploads/upload-1/entries'),
      { params: Promise.resolve({ id: 'upload-1' }) }
    )
    expect(res.status).toBe(500)
  })
})
