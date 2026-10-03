import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAcademicHeadUser, mockProgramHeadUser, authResultUser } from '../../mocks/auth'

vi.mock('@/lib/supabase/auth-helper', () => ({
  getAuthUserWithRoles: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/backend/course', () => ({
  getPendingBatches: vi.fn(),
  getBatchDetails: vi.fn(),
  approveBatch: vi.fn(),
  rejectBatchRows: vi.fn(),
  rejectBatch: vi.fn(),
  sendBackBatch: vi.fn(),
}))

vi.mock('@/lib/errors', () => ({
  getErrorMessage: (e: any) => e?.message ?? 'Unknown error',
}))

import { GET as GETPending } from '@/app/api/courses/approval/pending/route'
import { GET as GETBatch } from '@/app/api/courses/approval/batch/[id]/route'
import { POST as POSTApprove } from '@/app/api/courses/approval/batch/[id]/approve/route'
import { POST as POSTReject } from '@/app/api/courses/approval/batch/[id]/reject/route'
import { POST as POSTSendBack } from '@/app/api/courses/approval/batch/[id]/send-back/route'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { createAdminClient } from '@/lib/supabase/server'
import {
  getPendingBatches,
  getBatchDetails,
  approveBatch,
  rejectBatchRows,
  rejectBatch,
  sendBackBatch,
} from '@/backend/course'

const mockAuth = vi.mocked(getAuthUserWithRoles)
const mockAdmin = vi.mocked(createAdminClient)
const mockGetPending = vi.mocked(getPendingBatches)
const mockGetBatchDetails = vi.mocked(getBatchDetails)
const mockApproveBatch = vi.mocked(approveBatch)
const mockRejectRows = vi.mocked(rejectBatchRows)
const mockRejectBatch = vi.mocked(rejectBatch)
const mockSendBack = vi.mocked(sendBackBatch)

function makeRequest(url: string, method = 'GET', body?: any) {
  const opts: ConstructorParameters<typeof NextRequest>[1] = { method }
  if (body) {
    opts.body = JSON.stringify(body)
    opts.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(`http://localhost:3000${url}`, opts)
}

const batchParams = Promise.resolve({ id: 'batch-001' })

describe('GET /api/courses/approval/pending', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null, error: 'Session expired' })
    const res = await GETPending(makeRequest('/api/courses/approval/pending'))
    expect(res.status).toBe(401)
  })

  it('should return 403 for non-academic_head', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockProgramHeadUser), error: null })
    const res = await GETPending(makeRequest('/api/courses/approval/pending'))
    expect(res.status).toBe(403)
  })

  it('should return batches and individual courses', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockGetPending.mockResolvedValue([{ id: 'b1' }] as any)

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'c1', profiles: { full_name: 'Prof Smith' } }],
        }),
        eq: vi.fn().mockReturnThis(),
      }),
    }
    mockAdmin.mockReturnValue(mockSupabase as any)

    const res = await GETPending(makeRequest('/api/courses/approval/pending'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.batches).toHaveLength(1)
    expect(data.individualCourses[0].created_by_name).toBe('Prof Smith')
  })

  it('should filter by department_code', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockGetPending.mockResolvedValue([] as any)

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
      eq: vi.fn().mockReturnThis(),
    }
    mockAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(mockQuery) } as any)

    await GETPending(makeRequest('/api/courses/approval/pending?department_code=IT'))
    expect(mockGetPending).toHaveBeenCalledWith(expect.anything(), 'IT')
  })
})

describe('GET /api/courses/approval/batch/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null, error: 'Session expired' })
    const res = await GETBatch(makeRequest('/api/courses/approval/batch/x'), { params: batchParams })
    expect(res.status).toBe(401)
  })

  it('should return 403 for non-academic_head', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockProgramHeadUser), error: null })
    const res = await GETBatch(makeRequest('/api/courses/approval/batch/x'), { params: batchParams })
    expect(res.status).toBe(403)
  })

  it('should return batch details', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockAdmin.mockReturnValue({} as any)
    mockGetBatchDetails.mockResolvedValue({ id: 'b1', courses: [] } as any)

    const res = await GETBatch(makeRequest('/api/courses/approval/batch/x'), { params: batchParams })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.batch.id).toBe('b1')
  })

  it('should return 404 when batch not found', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockAdmin.mockReturnValue({} as any)
    mockGetBatchDetails.mockResolvedValue(null as any)

    const res = await GETBatch(makeRequest('/api/courses/approval/batch/x'), { params: batchParams })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/courses/approval/batch/[id]/approve', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null, error: 'Session expired' })
    const res = await POSTApprove(makeRequest('/api/courses/approval/batch/x/approve', 'POST'), { params: batchParams })
    expect(res.status).toBe(401)
  })

  it('should return 403 for non-academic_head', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockProgramHeadUser), error: null })
    const res = await POSTApprove(makeRequest('/api/courses/approval/batch/x/approve', 'POST'), { params: batchParams })
    expect(res.status).toBe(403)
  })

  it('should approve batch successfully', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockAdmin.mockReturnValue({} as any)
    mockApproveBatch.mockResolvedValue({ approvedCount: 5 } as any)

    const res = await POSTApprove(makeRequest('/api/courses/approval/batch/x/approve', 'POST'), { params: batchParams })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})

describe('POST /api/courses/approval/batch/[id]/reject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null, error: 'Session expired' })
    const res = await POSTReject(makeRequest('/api/courses/approval/batch/x/reject', 'POST', { reason: 'bad' }), { params: batchParams })
    expect(res.status).toBe(401)
  })

  it('should return 400 for invalid JSON', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const req = new NextRequest('http://localhost:3000/api/courses/approval/batch/x/reject', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    })
    const res = await POSTReject(req, { params: batchParams })
    expect(res.status).toBe(400)
  })

  it('should return 400 when validation fails', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const res = await POSTReject(makeRequest('/api/courses/approval/batch/x/reject', 'POST', {}), { params: batchParams })
    expect(res.status).toBe(400)
  })

  it('should return 400 when neither course_ids nor reject_all provided', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockAdmin.mockReturnValue({} as any)

    const res = await POSTReject(makeRequest('/api/courses/approval/batch/x/reject', 'POST', { reason: 'Not acceptable' }), { params: batchParams })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('course_ids')
  })

  it('should reject specific rows', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockAdmin.mockReturnValue({} as any)
    mockRejectRows.mockResolvedValue({ rejectedCount: 2 } as any)

    const res = await POSTReject(
      makeRequest('/api/courses/approval/batch/x/reject', 'POST', {
        reason: 'Not acceptable',
        course_ids: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'],
      }),
      { params: batchParams }
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('should reject entire batch', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockAdmin.mockReturnValue({} as any)
    mockRejectBatch.mockResolvedValue(undefined as any)

    const res = await POSTReject(
      makeRequest('/api/courses/approval/batch/x/reject', 'POST', { reason: 'Batch not acceptable', reject_all: true }),
      { params: batchParams }
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.message).toContain('batch rejected')
  })
})

describe('POST /api/courses/approval/batch/[id]/send-back', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null, error: 'Session expired' })
    const res = await POSTSendBack(makeRequest('/api/courses/approval/batch/x/send-back', 'POST', { notes: 'Fix this' }), { params: batchParams })
    expect(res.status).toBe(401)
  })

  it('should return 400 for validation failure (empty notes)', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const res = await POSTSendBack(makeRequest('/api/courses/approval/batch/x/send-back', 'POST', { notes: '' }), { params: batchParams })
    expect(res.status).toBe(400)
  })

  it('should send back batch successfully', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockAdmin.mockReturnValue({} as any)
    mockSendBack.mockResolvedValue(undefined as any)

    const res = await POSTSendBack(
      makeRequest('/api/courses/approval/batch/x/send-back', 'POST', { notes: 'Please fix row 3' }),
      { params: batchParams }
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})
