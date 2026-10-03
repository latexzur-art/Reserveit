import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../mocks/supabase'
import {
  createCourse,
  createCourseBatch,
  getCoursesByDepartment,
  getCourseByCodeAndDept,
  updateCourse,
} from '@/backend/course/course.service'

describe('course.service', () => {
  let supabase: ReturnType<typeof createMockSupabaseClient>

  const validInput = {
    department_code: 'CS',
    course_code: 'CS101',
    course_name: 'Intro to CS',
    units: 3,
    year_level: 1,
    term: 1 as const,
    delivery_mode: 'lecture' as const,
    lecture_hours: 3,
    lab_hours: null,
  }

  const mockCourse = {
    id: 'course-001',
    ...validInput,
    approval_status: 'pending',
    created_by: 'user-001',
    created_at: '2026-01-01T00:00:00Z',
  }

  beforeEach(() => {
    supabase = createMockSupabaseClient()
  })

  describe('createCourse', () => {
    it('should insert a course with pending status', async () => {
      supabase.from.mockImplementation(() => {
        const chain: any = {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
        }
        return chain
      })

      const result = await createCourse(supabase as any, validInput, 'user-001')
      expect(result).toEqual(mockCourse)
      expect(supabase.from).toHaveBeenCalledWith('courses')
    })

    it('should throw on supabase error', async () => {
      supabase.from.mockImplementation(() => {
        const chain: any = {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }
        return chain
      })

      await expect(createCourse(supabase as any, validInput, 'user-001'))
        .rejects.toThrow('Failed to create course: DB error')
    })
  })

  describe('createCourseBatch', () => {
    it('should insert multiple courses with upload id', async () => {
      const courses = [mockCourse, { ...mockCourse, id: 'course-002', course_code: 'CS102' }]
      supabase.from.mockImplementation(() => {
        const chain: any = {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (res: any) => Promise.resolve({ data: courses, error: null }).then(res),
        }
        return chain
      })

      const result = await createCourseBatch(supabase as any, [validInput, validInput], 'upload-001', 'user-001')
      expect(result).toHaveLength(2)
    })
  })

  describe('getCoursesByDepartment', () => {
    it('should fetch courses with filters and pagination', async () => {
      const courses = [mockCourse]
      supabase.from.mockImplementation(() => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          then: (res: any) => Promise.resolve({ data: courses, count: 1, error: null }).then(res),
        }
        return chain
      })

      const result = await getCoursesByDepartment(supabase as any, {
        department_code: 'CS',
        page: 1,
        limit: 25,
      })
      expect(result.courses).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('should apply search filter', async () => {
      supabase.from.mockImplementation(() => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          then: (res: any) => Promise.resolve({ data: [], count: 0, error: null }).then(res),
        }
        return chain
      })

      const result = await getCoursesByDepartment(supabase as any, { search: 'intro' })
      expect(result.courses).toHaveLength(0)
    })
  })

  describe('getCourseByCodeAndDept', () => {
    it('should return course when found', async () => {
      supabase.from.mockImplementation(() => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
        }
        return chain
      })

      const result = await getCourseByCodeAndDept(supabase as any, 'CS101', 'CS')
      expect(result).toEqual(mockCourse)
    })

    it('should return null when not found (PGRST116)', async () => {
      supabase.from.mockImplementation(() => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } }),
        }
        return chain
      })

      const result = await getCourseByCodeAndDept(supabase as any, 'NOPE', 'CS')
      expect(result).toBeNull()
    })
  })

  describe('updateCourse', () => {
    it('should update a pending course', async () => {
      const callCount = { n: 0 }
      supabase.from.mockImplementation(() => {
        callCount.n++
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(),
        }
        if (callCount.n === 1) {
          // First call: check approval_status
          chain.single.mockResolvedValue({ data: { approval_status: 'pending' }, error: null })
        } else {
          // Second call: perform update
          chain.single.mockResolvedValue({ data: { ...mockCourse, course_name: 'Updated' }, error: null })
        }
        return chain
      })

      const result = await updateCourse(supabase as any, 'course-001', { course_name: 'Updated' }, 'user-001')
      expect(result.course_name).toBe('Updated')
    })

    it('should throw when course not found', async () => {
      supabase.from.mockImplementation(() => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
        return chain
      })

      await expect(updateCourse(supabase as any, 'nonexistent', {}, 'user-001'))
        .rejects.toThrow('Course not found')
    })

    it('should throw when course is already approved', async () => {
      supabase.from.mockImplementation(() => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { approval_status: 'approved' }, error: null }),
        }
        return chain
      })

      await expect(updateCourse(supabase as any, 'course-001', {}, 'user-001'))
        .rejects.toThrow('Can only edit pending or sent-back courses')
    })
  })
})
