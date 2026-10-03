import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAcademicHeadUser, mockFacultyUser, authResultUser } from '../../mocks/auth'

vi.mock('@/lib/supabase/auth-helper', () => ({
  getAuthUserWithRoles: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/backend/course', () => ({
  createUploadBatch: vi.fn(),
  validateAndPreviewBatch: vi.fn(),
  commitBatch: vi.fn(),
  submitBatch: vi.fn(),
}))

vi.mock('@/lib/errors', () => ({
  getErrorMessage: (e: any) => e?.message ?? 'Unknown error',
}))


import { POST as POSTSubmit } from '@/app/api/courses/batch/[id]/submit/route'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { createAdminClient } from '@/lib/supabase/server'
import { createUploadBatch, validateAndPreviewBatch, commitBatch, submitBatch } from '@/backend/course'

const mockAuth = vi.mocked(getAuthUserWithRoles)
const mockAdmin = vi.mocked(createAdminClient)
const mockCreateBatch = vi.mocked(createUploadBatch)
const mockValidatePreview = vi.mocked(validateAndPreviewBatch)
const mockCommitBatch = vi.mocked(commitBatch)
const mockSubmitBatch = vi.mocked(submitBatch)

function jsonRequest(url: string, body: any) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}



describe('POST /api/courses/batch/[id]/submit', () => {
  const params = Promise.resolve({ id: 'batch-001' })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdmin.mockReturnValue({} as any)
  })

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null, error: 'Session expired' })
    const req = new NextRequest('http://localhost:3000/api/courses/batch/x/submit', { method: 'POST' })
    const res = await POSTSubmit(req, { params })
    expect(res.status).toBe(401)
  })

  it('should return 403 for unauthorized role', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockFacultyUser), error: null })
    const req = new NextRequest('http://localhost:3000/api/courses/batch/x/submit', { method: 'POST' })
    const res = await POSTSubmit(req, { params })
    expect(res.status).toBe(403)
  })

  it('should submit batch successfully', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockSubmitBatch.mockResolvedValue(undefined as any)

    const req = new NextRequest('http://localhost:3000/api/courses/batch/x/submit', { method: 'POST' })
    const res = await POSTSubmit(req, { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('should return 500 on service error', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockSubmitBatch.mockRejectedValue(new Error('Batch not found'))

    const req = new NextRequest('http://localhost:3000/api/courses/batch/x/submit', { method: 'POST' })
    const res = await POSTSubmit(req, { params })
    expect(res.status).toBe(500)
  })
})
