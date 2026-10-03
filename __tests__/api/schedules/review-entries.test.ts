import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  mockAcademicHeadUser,
  mockProgramHeadUser,
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

vi.mock('@/backend/schedule/entryValidator', () => ({
  validateAndEnrichEntry: vi.fn(),
  revalidateUploadHours: vi.fn(),

}))

vi.mock('@/backend/schedule/conflictDetector', () => ({
  detectConflicts: vi.fn(),
  detectAllConflicts: vi.fn(),
}))

vi.mock('@/backend/schedule/uploadCountUpdater', () => ({
  updateUploadCounts: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET } from '@/app/api/schedules/review/[uploadId]/entries/route'
import { PUT } from '@/app/api/schedules/review/[uploadId]/entries/[entryId]/route'
import { requireAcademicHeadOrBuildingAdmin, requireProgramHead } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { validateAndEnrichEntry } from '@/backend/schedule/entryValidator'
import { detectConflicts } from '@/backend/schedule/conflictDetector'
import { updateUploadCounts } from '@/backend/schedule/uploadCountUpdater'

const mockCreateAdmin = vi.mocked(createAdminClient)
const mockRequireAcademicHead = vi.mocked(requireAcademicHeadOrBuildingAdmin)
const mockRequireProgramHead = vi.mocked(requireProgramHead)
const mockValidateAndEnrich = vi.mocked(validateAndEnrichEntry)
const mockDetectConflicts = vi.mocked(detectConflicts)
const mockUpdateUploadCounts = vi.mocked(updateUploadCounts)

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest(url: string) {
  return new NextRequest(url, { method: 'GET' })
}

function makePutRequest(url: string, body: any) {
  return new NextRequest(url, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
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

// ── GET /api/schedules/review/[uploadId]/entries ─────────────────────────────

describe('GET /api/schedules/review/[uploadId]/entries', () => {
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

    const res = await GET(
      makeGetRequest('http://localhost/api/schedules/review/upload-1/entries'),
      { params: Promise.resolve({ uploadId: 'upload-1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('should return paginated entries on success', async () => {
    const entries = [
      { id: 'e1', course_code: 'CS101', row_number: 1 },
      { id: 'e2', course_code: 'CS102', row_number: 2 },
    ]
    const chain = chainableMock({ data: entries, error: null, count: 2 })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await GET(
      makeGetRequest('http://localhost/api/schedules/review/upload-1/entries'),
      { params: Promise.resolve({ uploadId: 'upload-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.entries).toHaveLength(2)
    expect(json.total).toBe(2)
    expect(json.page).toBe(1)
  })

  it('should pass academic_head_review_status filter to query', async () => {
    const chain = chainableMock({ data: [], error: null, count: 0 })
    const fromFn = vi.fn().mockReturnValue(chain)
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    await GET(
      makeGetRequest('http://localhost/api/schedules/review/upload-1/entries?academic_head_review_status=pending_review'),
      { params: Promise.resolve({ uploadId: 'upload-1' }) }
    )
    expect(chain.eq).toHaveBeenCalledWith('academic_head_review_status', 'pending_review')
  })

  it('should respect page and page_size params', async () => {
    const chain = chainableMock({ data: [], error: null, count: 0 })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    await GET(
      makeGetRequest('http://localhost/api/schedules/review/upload-1/entries?page=2&page_size=50'),
      { params: Promise.resolve({ uploadId: 'upload-1' }) }
    )
    // offset = (2-1)*50 = 50, range(50, 99)
    expect(chain.range).toHaveBeenCalledWith(50, 99)
  })

  it('should return 500 on database error', async () => {
    const chain = chainableMock({ data: null, error: { message: 'DB error' }, count: null })
    Object.defineProperty(chain, 'then', {
      value: (resolve: any, reject: any) =>
        Promise.resolve({ data: null, error: { message: 'DB error' }, count: null }).then(resolve, reject),
      writable: true,
    })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await GET(
      makeGetRequest('http://localhost/api/schedules/review/upload-1/entries'),
      { params: Promise.resolve({ uploadId: 'upload-1' }) }
    )
    expect(res.status).toBe(500)
  })
})

// ── PUT /api/schedules/review/[uploadId]/entries/[entryId] ───────────────────

describe('PUT /api/schedules/review/[uploadId]/entries/[entryId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireProgramHead.mockResolvedValue({ error: null, user: authResultUser(mockProgramHeadUser) })
  })

  it('should return 401 when not authenticated', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
    mockRequireProgramHead.mockResolvedValue({ error: errorResponse as any, user: null as any })

    const res = await PUT(
      makePutRequest('http://localhost/api/schedules/review/upload-1/entries/entry-1', {
        course_code: 'CS101',
        course_name: 'Intro CS',
        section: 'A',
        facility_name_raw: 'Room 101',
        instructor_name: 'Dr. Smith',
        day_of_week: 1,
        start_time: '08:00',
        end_time: '09:00',
      }),
      { params: Promise.resolve({ uploadId: 'upload-1', entryId: 'entry-1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('should return 404 when entry not found', async () => {
    const chain = chainableMock({ data: null, error: { message: 'not found' } })
    mockCreateAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as any)

    const res = await PUT(
      makePutRequest('http://localhost/api/schedules/review/upload-1/entries/bad-id', {
        course_code: 'CS101',
        course_name: 'Intro CS',
        section: 'A',
        facility_name_raw: 'Room 101',
        instructor_name: 'Dr. Smith',
        day_of_week: 1,
        start_time: '08:00',
        end_time: '09:00',
      }),
      { params: Promise.resolve({ uploadId: 'upload-1', entryId: 'bad-id' }) }
    )
    expect(res.status).toBe(404)
  })

  it('should validate, update, detect conflicts and return enriched entry', async () => {
    const existing = { row_number: 1, effective_start_date: '2026-01-01', effective_end_date: '2026-05-31' }
    const parsedEntry = {
      course_code: 'CS101',
      course_name: 'Intro to CS',
      section: 'A',
      facility_name_raw: 'Room 101',
      facility_id: 'fac-1',
      facility_match_confidence: 1.0,
      instructor_name: 'Dr. Smith',
      instructor_id: null,
      day_of_week: 1,
      start_time: '08:00',
      end_time: '09:00',
      effective_start_date: null,
      effective_end_date: null,
      validation_status: 'valid',
      validation_errors: [],
      validation_warnings: [],
      has_internal_conflict: false,
      has_external_conflict: false,
    }
    const updatedEntry = { id: 'entry-1', ...parsedEntry, facilities: { name: 'Rm 101', room_number: '101' } }
    const refreshedEntry = { ...updatedEntry, has_internal_conflict: false, has_external_conflict: false }

    mockValidateAndEnrich.mockResolvedValue(parsedEntry as any)
    mockDetectConflicts.mockResolvedValue([])
    mockUpdateUploadCounts.mockResolvedValue({ valid: 10, warning: 1, error: 0, conflict: 0 } as any)

    let callIdx = 0
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        // Fetch existing entry
        return chainableMock({ data: existing, error: null })
      }
      if (callIdx === 2) {
        // Update entry
        return chainableMock({ data: updatedEntry, error: null })
      }
      // Re-read refreshed entry
      return chainableMock({ data: refreshedEntry, error: null })
    })
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    const res = await PUT(
      makePutRequest('http://localhost/api/schedules/review/upload-1/entries/entry-1', {
        course_code: 'CS101',
        course_name: 'Intro to CS',
        section: 'A',
        facility_name_raw: 'Room 101',
        instructor_name: 'Dr. Smith',
        day_of_week: 1,
        start_time: '08:00',
        end_time: '09:00',
      }),
      { params: Promise.resolve({ uploadId: 'upload-1', entryId: 'entry-1' }) }
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('entry-1')
    expect(json.conflicts).toEqual([])
    expect(json.upload_counts).toBeDefined()
  })

  it('should return 500 when update fails in database', async () => {
    const existing = { row_number: 1, effective_start_date: '2026-01-01', effective_end_date: '2026-05-31' }
    const parsedEntry = {
      course_code: 'CS101',
      course_name: 'Intro to CS',
      section: 'A',
      facility_name_raw: 'Room 101',
      facility_id: 'fac-1',
      facility_match_confidence: 1.0,
      instructor_name: 'Dr. Smith',
      instructor_id: null,
      day_of_week: 1,
      start_time: '08:00',
      end_time: '09:00',
      effective_start_date: null,
      effective_end_date: null,
      validation_status: 'valid',
      validation_errors: [],
      validation_warnings: [],
      has_internal_conflict: false,
      has_external_conflict: false,
    }

    mockValidateAndEnrich.mockResolvedValue(parsedEntry as any)

    let callIdx = 0
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        return chainableMock({ data: existing, error: null })
      }
      // Update fails
      return chainableMock({ data: null, error: { message: 'Update constraint violation' } })
    })
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    const res = await PUT(
      makePutRequest('http://localhost/api/schedules/review/upload-1/entries/entry-1', {
        course_code: 'CS101',
        course_name: 'Intro to CS',
        section: 'A',
        facility_name_raw: 'Room 101',
        instructor_name: 'Dr. Smith',
        day_of_week: 1,
        start_time: '08:00',
        end_time: '09:00',
      }),
      { params: Promise.resolve({ uploadId: 'upload-1', entryId: 'entry-1' }) }
    )
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('Update constraint violation')
  })

  it('should map numeric day_of_week back to string for validation', async () => {
    const existing = { row_number: 5, effective_start_date: '2026-01-01', effective_end_date: '2026-05-31' }
    const parsedEntry = {
      course_code: 'CS101',
      course_name: 'Intro CS',
      section: 'B',
      facility_name_raw: 'Lab 1',
      facility_id: 'fac-2',
      facility_match_confidence: 1.0,
      instructor_name: 'Dr. Jones',
      instructor_id: null,
      day_of_week: 3,
      start_time: '10:00',
      end_time: '11:30',
      effective_start_date: null,
      effective_end_date: null,
      validation_status: 'valid',
      validation_errors: [],
      validation_warnings: [],
      has_internal_conflict: false,
      has_external_conflict: false,
    }
    const updatedEntry = { id: 'entry-1', ...parsedEntry }

    mockValidateAndEnrich.mockResolvedValue(parsedEntry as any)
    mockDetectConflicts.mockResolvedValue([])
    mockUpdateUploadCounts.mockResolvedValue({ valid: 5, warning: 0, error: 0, conflict: 0 } as any)

    let callIdx = 0
    const fromFn = vi.fn().mockImplementation(() => {
      callIdx++
      if (callIdx === 1) return chainableMock({ data: existing, error: null })
      return chainableMock({ data: updatedEntry, error: null })
    })
    mockCreateAdmin.mockReturnValue({ from: fromFn } as any)

    await PUT(
      makePutRequest('http://localhost/api/schedules/review/upload-1/entries/entry-1', {
        course_code: 'CS101',
        course_name: 'Intro CS',
        section: 'B',
        facility_name_raw: 'Lab 1',
        instructor_name: 'Dr. Jones',
        day_of_week: 3, // Wednesday = index 3 = 'wed'
        start_time: '10:00',
        end_time: '11:30',
      }),
      { params: Promise.resolve({ uploadId: 'upload-1', entryId: 'entry-1' }) }
    )

    // Verify validateAndEnrichEntry was called with day_of_week_raw = 'wed'
    expect(mockValidateAndEnrich).toHaveBeenCalledTimes(1)
    const rawRow = mockValidateAndEnrich.mock.calls[0][1]
    expect(rawRow.day_of_week_raw).toBe('wed')
  })
})
