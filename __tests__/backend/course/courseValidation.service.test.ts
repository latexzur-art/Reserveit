import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient } from '../../mocks/supabase'
import { validateCourse, parseTemplateRow } from '@/backend/course/courseValidation.service'

describe('courseValidation.service', () => {
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

  beforeEach(() => {
    supabase = createMockSupabaseClient()
  })

  // Department lookup uses `.maybeSingle()`; duplicate lookup uses `.single()`.
  function setupFrom(opts: { deptExists?: boolean; courseExists?: boolean } = {}) {
    const { deptExists = true, courseExists = false } = opts
    supabase.from.mockImplementation(() => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: courseExists ? { id: 'exists' } : null,
          error: courseExists ? null : { code: 'PGRST116' },
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: deptExists ? { code: 'CS' } : null,
          error: null,
        }),
      }
      return chain
    })
  }

  describe('validateCourse', () => {
    it('should validate a correct course input', async () => {
      setupFrom({ deptExists: true, courseExists: false })
      const result = await validateCourse(supabase as any, validInput)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return error for non-existent department', async () => {
      setupFrom({ deptExists: false })
      const result = await validateCourse(supabase as any, validInput)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'department_code')).toBe(true)
    })

    it('should return error for invalid course code format', async () => {
      setupFrom()
      const result = await validateCourse(supabase as any, { ...validInput, course_code: 'cs-101' })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'course_code')).toBe(true)
    })

    it('should return error for invalid units', async () => {
      setupFrom()
      const result = await validateCourse(supabase as any, { ...validInput, units: 0 })
      expect(result.errors.some(e => e.field === 'units')).toBe(true)
    })

    it('should return error for invalid year_level', async () => {
      setupFrom()
      const result = await validateCourse(supabase as any, { ...validInput, year_level: 5 })
      expect(result.errors.some(e => e.field === 'year_level')).toBe(true)
    })

    it('should return error for invalid term', async () => {
      setupFrom()
      const result = await validateCourse(supabase as any, { ...validInput, term: 4 as any })
      expect(result.errors.some(e => e.field === 'term')).toBe(true)
    })

    it('should accept term 3 (Summer/Midyear)', async () => {
      setupFrom()
      const result = await validateCourse(supabase as any, { ...validInput, term: 3 as any })
      expect(result.errors.some(e => e.field === 'term')).toBe(false)
    })

    it('should require lecture_hours when delivery_mode is lecture', async () => {
      setupFrom()
      const result = await validateCourse(supabase as any, {
        ...validInput,
        delivery_mode: 'lecture',
        lecture_hours: null,
      })
      expect(result.errors.some(e => e.field === 'lecture_hours')).toBe(true)
    })

    it('should require lab_hours when delivery_mode is lab', async () => {
      setupFrom()
      const result = await validateCourse(supabase as any, {
        ...validInput,
        delivery_mode: 'lab',
        lab_hours: null,
      })
      expect(result.errors.some(e => e.field === 'lab_hours')).toBe(true)
    })

    it('should skip duplicate check when skipDuplicateCheck is true', async () => {
      setupFrom({ deptExists: true, courseExists: true })
      const result = await validateCourse(supabase as any, validInput, { skipDuplicateCheck: true })
      // No duplicate warning since the check was skipped
      expect(result.warnings.filter(w => w.message.includes('already exists'))).toHaveLength(0)
    })
  })

  describe('parseTemplateRow', () => {
    it('should parse a valid template row', () => {
      const row = {
        department_code: 'cs',
        course_code: 'cs101',
        course_name: 'Intro to CS',
        units: '3',
        year_level: '1',
        term: '1',
        delivery_mode: 'Lecture',
        lecture_hours: '3',
        lab_hours: '',
      }

      const result = parseTemplateRow(row as any, 1)
      expect(result.errors).toHaveLength(0)
      expect(result.input).not.toBeNull()
      expect(result.input!.department_code).toBe('CS') // uppercased
      expect(result.input!.course_code).toBe('CS101') // uppercased
      expect(result.input!.units).toBe(3)
      expect(result.input!.delivery_mode).toBe('lecture') // lowercased
    })

    it('should return errors for missing required fields', () => {
      const row = {
        department_code: '',
        course_code: '',
        course_name: '',
        units: 'abc',
        year_level: 'abc',
        term: 'abc',
        delivery_mode: 'invalid',
      }

      const result = parseTemplateRow(row as any, 2)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.input).toBeNull()
    })

    it('should parse prerequisite codes from comma-separated string', () => {
      const row = {
        department_code: 'CS',
        course_code: 'CS201',
        course_name: 'Data Structures',
        units: '3',
        year_level: '2',
        term: '1',
        delivery_mode: 'lecture',
        lecture_hours: '3',
        prerequisite_codes: 'CS101, CS102; CS103',
      }

      const result = parseTemplateRow(row as any, 1)
      expect(result.input!.prerequisite_codes).toEqual(['CS101', 'CS102', 'CS103'])
    })

    it('should parse is_elective from string values', () => {
      const row = {
        department_code: 'CS',
        course_code: 'CS301',
        course_name: 'Elective Course',
        units: '3',
        year_level: '3',
        term: '1',
        delivery_mode: 'lecture',
        lecture_hours: '3',
        is_elective: 'yes',
      }

      const result = parseTemplateRow(row as any, 1)
      expect(result.input!.is_elective).toBe(true)
    })
  })
})
