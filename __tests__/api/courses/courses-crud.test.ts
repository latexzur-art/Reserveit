import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  mockAcademicHeadUser,
  mockProgramHeadUser,
  mockFacultyUser,
  authResultUser,
} from '../../mocks/auth'

vi.mock('@/lib/supabase/auth-helper', () => ({
  getAuthUserWithRoles: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/backend/course', () => ({
  getCoursesByDepartment: vi.fn(),
  createCourse: vi.fn(),
  validateCourse: vi.fn(),
  updateCourse: vi.fn(),
}))

vi.mock('@/lib/errors', () => ({
  getErrorMessage: (e: any) => e?.message ?? 'Unknown error',
}))

import { GET, POST } from '@/app/api/courses/route'
import { PUT, PATCH } from '@/app/api/courses/[id]/route'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { createAdminClient } from '@/lib/supabase/server'
import { getCoursesByDepartment, createCourse, validateCourse, updateCourse } from '@/backend/course'

const mockAuth = vi.mocked(getAuthUserWithRoles)
const mockAdmin = vi.mocked(createAdminClient)
const mockGetCourses = vi.mocked(getCoursesByDepartment)
const mockCreateCourse = vi.mocked(createCourse)
const mockValidateCourse = vi.mocked(validateCourse)
const mockUpdateCourse = vi.mocked(updateCourse)

function makeRequest(url: string, opts?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost:3000${url}`, opts)
}

function jsonRequest(url: string, method: string, body: any) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validCourseInput = {
  department_code: 'CS',
  course_code: 'CS101',
  course_name: 'Intro to CS',
  units: 3,
  year_level: 1,
  term: 1,
  delivery_mode: 'lecture' as const,
}

describe('GET /api/courses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdmin.mockReturnValue({} as any)
  })

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null, error: 'Session expired' })
    const res = await GET(makeRequest('/api/courses'))
    expect(res.status).toBe(401)
  })

  it('should return courses with pagination', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockGetCourses.mockResolvedValue({ courses: [{ id: 'c1' }], total: 1 } as any)

    const res = await GET(makeRequest('/api/courses?page=1&limit=10'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.courses).toHaveLength(1)
  })

  it('should restrict program_head to own department', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockProgramHeadUser), error: null })
    mockGetCourses.mockResolvedValue({ courses: [], total: 0 } as any)

    await GET(makeRequest('/api/courses'))
    expect(mockGetCourses).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ department_code: 'CS' })
    )
  })

  it('should pass filter params', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockGetCourses.mockResolvedValue({ courses: [], total: 0 } as any)

    await GET(makeRequest('/api/courses?year_level=2&term=1&delivery_mode=lab&approval_status=pending&search=test&department_code=IT'))
    expect(mockGetCourses).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        year_level: 2,
        term: 1,
        delivery_mode: 'lab',
        approval_status: 'pending',
        search: 'test',
        department_code: 'IT',
      })
    )
  })

  it('should return 500 on service error', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockGetCourses.mockRejectedValue(new Error('DB error'))

    const res = await GET(makeRequest('/api/courses'))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/courses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdmin.mockReturnValue({} as any)
  })

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null, error: 'Session expired' })
    const res = await POST(jsonRequest('/api/courses', 'POST', validCourseInput))
    expect(res.status).toBe(401)
  })

  it('should return 403 for faculty user', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockFacultyUser), error: null })
    const res = await POST(jsonRequest('/api/courses', 'POST', validCourseInput))
    expect(res.status).toBe(403)
  })

  it('should return 400 for invalid JSON', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const req = new NextRequest('http://localhost:3000/api/courses', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('should return 400 for Zod validation failure', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const res = await POST(jsonRequest('/api/courses', 'POST', { course_code: 'X' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('should return 400 when course validation fails', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockValidateCourse.mockResolvedValue({ valid: false, errors: ['Duplicate code'], warnings: [] } as any)

    const res = await POST(jsonRequest('/api/courses', 'POST', validCourseInput))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Course validation failed')
  })

  it('should create course and return 201', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockValidateCourse.mockResolvedValue({ valid: true, warnings: [] } as any)
    mockCreateCourse.mockResolvedValue({ id: 'c1', ...validCourseInput } as any)

    const res = await POST(jsonRequest('/api/courses', 'POST', validCourseInput))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.course.id).toBe('c1')
  })
})

describe('PUT /api/courses/[id]', () => {
  const params = Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdmin.mockReturnValue({} as any)
  })

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ user: null, error: 'Session expired' })
    const res = await PUT(jsonRequest('/api/courses/x', 'PUT', { course_name: 'New' }), { params })
    expect(res.status).toBe(401)
  })

  it('should return 403 for unauthorized role', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockFacultyUser), error: null })
    const res = await PUT(jsonRequest('/api/courses/x', 'PUT', { course_name: 'New' }), { params })
    expect(res.status).toBe(403)
  })

  it('should return 400 for validation failure', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const res = await PUT(jsonRequest('/api/courses/x', 'PUT', { units: -1 }), { params })
    expect(res.status).toBe(400)
  })

  it('should update course successfully', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    mockUpdateCourse.mockResolvedValue({ id: 'c1', course_name: 'Updated' } as any)

    const res = await PUT(jsonRequest('/api/courses/x', 'PUT', { course_name: 'Updated' }), { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.course.course_name).toBe('Updated')
  })
})

describe('PATCH /api/courses/[id]', () => {
  const params = Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 403 for non-academic_head', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockProgramHeadUser), error: null })
    const res = await PATCH(jsonRequest('/api/courses/x', 'PATCH', { action: 'approve' }), { params })
    expect(res.status).toBe(403)
  })

  it('should return 400 for invalid action', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const res = await PATCH(jsonRequest('/api/courses/x', 'PATCH', { action: 'reject' }), { params })
    expect(res.status).toBe(400)
  })

  it('should return 404 when course not found or not pending', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }
    mockAdmin.mockReturnValue(mockSupabase as any)

    const res = await PATCH(jsonRequest('/api/courses/x', 'PATCH', { action: 'approve' }), { params })
    expect(res.status).toBe(404)
  })

  it('should approve course successfully', async () => {
    mockAuth.mockResolvedValue({ user: authResultUser(mockAcademicHeadUser), error: null })
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'c1', approval_status: 'approved' }, error: null }),
      }),
    }
    mockAdmin.mockReturnValue(mockSupabase as any)

    const res = await PATCH(jsonRequest('/api/courses/x', 'PATCH', { action: 'approve' }), { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.course.approval_status).toBe('approved')
  })
})
