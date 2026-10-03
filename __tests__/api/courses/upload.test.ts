import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAcademicHeadUser, mockFacultyUser, mockProgramHeadUser, authResultUser } from '../../mocks/auth'

vi.mock('@/lib/supabase/auth-helper', () => ({
  getAuthUserWithRoles: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

// Template + history routes import from the barrel
vi.mock('@/backend/course', () => ({
  generateExcelTemplate: vi.fn(),
  getUploadHistory: vi.fn(),
}))

// The upload + template routes import directly from the service module
vi.mock('@/backend/course/courseUpload.service', () => ({
  createUploadBatch: vi.fn(),
  parseCSVContent: vi.fn(),
  parseExcelContent: vi.fn(),
  validateAndPreviewBatch: vi.fn(),
  commitBatchAll: vi.fn(),
  generateExcelTemplate: vi.fn().mockResolvedValue(Buffer.from('fake-xlsx-bytes')),
}))

vi.mock('@/lib/errors', () => ({
  getErrorMessage: (e: any) => e?.message ?? 'Unknown error',
}))

import { POST as POSTUpload } from '@/app/api/courses/upload/route'
import { GET as GETTemplate } from '@/app/api/courses/upload/template/route'
import { GET as GETHistory } from '@/app/api/courses/upload/history/route'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { createAdminClient } from '@/lib/supabase/server'
import {
  createUploadBatch,
  parseCSVContent,
  validateAndPreviewBatch,
  commitBatchAll,
} from '@/backend/course/courseUpload.service'
import {
  generateExcelTemplate,
  getUploadHistory,
} from '@/backend/course'

const mockAuth = vi.mocked(getAuthUserWithRoles)
const mockAdmin = vi.mocked(createAdminClient)
const mockCreateBatch = vi.mocked(createUploadBatch)
const mockParseCSV = vi.mocked(parseCSVContent)
const mockValidatePreview = vi.mocked(validateAndPreviewBatch)
const mockCommitBatchAll = vi.mocked(commitBatchAll)
const mockGenTemplate = vi.mocked(generateExcelTemplate)
const mockGetHistory = vi.mocked(getUploadHistory)

describe('POST /api/courses/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as any)
  })

  function makeUploadRequest(fields: Record<string, string | File>) {
    const formData = new FormData()
    for (const [k, v] of Object.entries(fields)) formData.append(k, v)
    const req = new NextRequest('http://localhost:3000/api/courses/upload', {
      method: 'POST',
    })
    // Override formData() to return our FormData directly (jsdom loses File.name through NextRequest)
    req.formData = () => Promise.resolve(formData)
    return req
  }

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null, error: 'Session expired' })
    const file = new File(['a,b'], 'courses.csv', { type: 'text/csv' })
    const res = await POSTUpload(makeUploadRequest({ file, department_id: 'd1' }))
    expect(res.status).toBe(401)
  })

  it('should return 403 for unauthorized role', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockFacultyUser), error: null })
    const file = new File(['a,b'], 'courses.csv', { type: 'text/csv' })
    const res = await POSTUpload(makeUploadRequest({ file, department_id: 'd1' }))
    expect(res.status).toBe(403)
  })

  it('should return 400 when no file provided', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const res = await POSTUpload(makeUploadRequest({ department_id: 'd1' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('file')
  })

  it('should return 400 when department_id missing', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const file = new File(['a,b'], 'courses.csv', { type: 'text/csv' })
    const res = await POSTUpload(makeUploadRequest({ file }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('department_id')
  })

  it('should return 400 for unsupported file type', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    // .xlsx is now supported, so use a genuinely unsupported type
    const file = new File(['data'], 'courses.txt', { type: 'text/plain' })
    const res = await POSTUpload(makeUploadRequest({ file, department_id: 'd1' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('CSV')
  })

  it('should return 400 when no valid rows in CSV', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const file = new File(['header1,header2\n'], 'data.csv', { type: 'text/csv' })
    mockCreateBatch.mockResolvedValue({ id: 'batch-1' } as any)
    mockParseCSV.mockResolvedValue({ rows: [{ input: null, errors: ['Invalid row'] }] } as any)

    const res = await POSTUpload(makeUploadRequest({ file, department_id: 'd1' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('No valid rows')
  })

  it('should return 201 for valid CSV upload', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const file = new File(['code,name\nCS101,Intro'], 'data.csv', { type: 'text/csv' })

    mockCreateBatch.mockResolvedValue({ id: 'batch-1' } as any)
    mockParseCSV.mockResolvedValue({
      rows: [{ input: { course_code: 'CS101' }, errors: [] }],
    } as any)
    mockValidatePreview.mockResolvedValue({
      hasErrors: false,
      validRows: [{ course_code: 'CS101' }],
      results: [],
    } as any)
    mockCommitBatchAll.mockResolvedValue({ pendingCount: 1, rejectedCount: 0, skippedCount: 0 } as any)

    const res = await POSTUpload(makeUploadRequest({ file, department_id: 'd1' }))
    const data = await res.json()
    expect(data).toMatchObject({ batch_id: 'batch-1' })
    expect(res.status).toBe(201)
  })
})

describe('GET /api/courses/upload/template', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return xlsx with correct content-type', async () => {
    mockGenTemplate.mockResolvedValue(Buffer.from('fake-xlsx-bytes'))
    const req = new NextRequest('http://localhost:3000/api/courses/upload/template')
    const res = await GETTemplate(req)
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml')
    expect(res.headers.get('Content-Disposition')).toContain('course_template.xlsx')
  })
})

describe('GET /api/courses/upload/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null, error: 'Session expired' })
    const res = await GETHistory(new NextRequest('http://localhost:3000/api/courses/upload/history'))
    expect(res.status).toBe(401)
  })

  it('should return upload history with pagination', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockGetHistory.mockResolvedValue({ uploads: [{ id: 'u1' }], total: 1 } as any)

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], count: 0 }),
        eq: vi.fn().mockReturnThis(),
      }),
    }
    mockAdmin.mockReturnValue(mockSupabase as any)

    const res = await GETHistory(new NextRequest('http://localhost:3000/api/courses/upload/history?page=1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.uploads).toHaveLength(1)
  })

  it('should restrict program_head to own uploads', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockProgramHeadUser), error: null })
    mockGetHistory.mockResolvedValue({ uploads: [], total: 0 } as any)

    const eqFn = vi.fn().mockReturnThis()
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], count: 0 }),
        eq: eqFn,
      }),
    }
    mockAdmin.mockReturnValue(mockSupabase as any)

    await GETHistory(new NextRequest('http://localhost:3000/api/courses/upload/history'))
    expect(mockGetHistory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: mockProgramHeadUser.id })
    )
  })
})
