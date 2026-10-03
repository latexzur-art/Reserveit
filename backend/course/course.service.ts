/**
 * Course CRUD Service
 * Handles course catalog operations.
 * @module backend/course/course.service
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Course,
  CourseCreateInput,
  CourseFilters,
  CourseListItem,
  DeliveryMode,
  FacultyCourseResponse,
} from '@/types/course.types'

/** A course's "Both" delivery mode means it has a lecture component AND a lab
 * component, so filtering for either must also surface "Both" courses. */
export function deliveryModesMatching(mode: DeliveryMode): DeliveryMode[] {
  return mode === 'lecture' || mode === 'lab' ? [mode, 'both'] : [mode]
}

/**
 * Maps an academic term's `term_type` to the integer `courses.term` slot (1-3).
 * `courses.term` only has three slots: 1st semester, 2nd semester, and the
 * post-2nd-semester short term. Both `summer` and `midyear` denote that same
 * third term ("midyear" is the modern rename of "summer"), so both map to 3.
 */
export function termTypeToNumber(termType: string | null | undefined): 1 | 2 | 3 {
  if (termType === 'second_semester') return 2
  if (termType === 'summer' || termType === 'midyear') return 3
  return 1
}

/** Atomically insert-or-update rows keyed by (department_code, course_code), avoiding the
 * insert-vs-update race that a separate "check then write" would have. */
export async function upsertCourseRows(
  supabase: SupabaseClient,
  rows: Record<string, any>[]
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase
    .from('courses')
    .upsert(rows, { onConflict: 'department_code,course_code' })
  if (error) throw new Error(`Failed to save courses: ${error.message}`)
}

export async function createCourse(
  supabase: SupabaseClient,
  input: CourseCreateInput,
  userId: string,
  isAcademicHead = false
): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .insert({
      ...input,
      approval_status: isAcademicHead ? 'approved' : 'pending',
      created_by: userId,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error(`Course "${input.course_code}" already exists in department "${input.department_code}"`)
    throw new Error(`Failed to create course: ${error.message}`)
  }
  return data
}

export async function createCourseBatch(
  supabase: SupabaseClient,
  rows: CourseCreateInput[],
  uploadId: string,
  userId: string
): Promise<Course[]> {
  const inserts = rows.map(row => ({
    ...row,
    approval_status: 'pending' as const,
    batch_upload_id: uploadId,
    created_by: userId,
  }))

  await upsertCourseRows(supabase, inserts)

  const { data, error } = await supabase
    .from('courses')
    .select()
    .eq('batch_upload_id', uploadId)

  if (error) throw new Error(`Failed to load course batch: ${error.message}`)
  return data ?? []
}

export async function getCoursesByDepartment(
  supabase: SupabaseClient,
  filters: CourseFilters
): Promise<{ courses: Course[]; total: number }> {
  const page = filters.page ?? 1
  const limit = Math.min(filters.limit ?? 25, 100)
  const offset = (page - 1) * limit

  let query = supabase
    .from('courses')
    .select('*', { count: 'exact' })

  if (filters.department_code) query = query.eq('department_code', filters.department_code)
  if (filters.year_level) query = query.eq('year_level', filters.year_level)
  if (filters.term) query = query.eq('term', filters.term)
  if (filters.delivery_mode) query = query.in('delivery_mode', deliveryModesMatching(filters.delivery_mode))
  if (filters.approval_status) query = query.eq('approval_status', filters.approval_status)
  if (filters.search) {
    query = query.or(`course_code.ilike.%${filters.search}%,course_name.ilike.%${filters.search}%`)
  }
  if (filters.batch_upload_id) query = query.eq('batch_upload_id', filters.batch_upload_id)

  const { data, count, error } = await query
    .order('department_code')
    .order('year_level')
    .order('term')
    .order('course_code')
    .range(offset, offset + limit - 1)

  if (error) throw new Error(`Failed to fetch courses: ${error.message}`)
  return { courses: data ?? [], total: count ?? 0 }
}

export async function getActiveCoursesByTerm(
  supabase: SupabaseClient,
  termId: string,
  deptCode?: string
): Promise<Course[]> {
  // Map termId to the courses.term slot (1 = 1st Sem, 2 = 2nd Sem, 3 = Summer/Midyear)
  const { data: term } = await supabase
    .from('academic_terms')
    .select('term_type')
    .eq('id', termId)
    .single()

  if (!term) throw new Error('Academic term not found')

  const termNumber = termTypeToNumber(term.term_type)

  let query = supabase
    .from('courses')
    .select('*')
    .eq('approval_status', 'approved')
    .eq('is_active', true)
    .eq('term', termNumber)

  if (deptCode) query = query.eq('department_code', deptCode)

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch active courses: ${error.message}`)

  return data ?? []
}

export async function getCourseByCodeAndDept(
  supabase: SupabaseClient,
  courseCode: string,
  deptCode: string
): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('course_code', courseCode)
    .eq('department_code', deptCode)
    .single()

  if (error && error.code !== 'PGRST116') throw new Error(`Failed to fetch course: ${error.message}`)
  return data ?? null
}

export async function updateCourse(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<CourseCreateInput>,
  userId: string,
  isAcademicHead = false
): Promise<Course> {
  // Only allow editing pending or sent_back courses (academic heads can edit any status)
  const { data: existing } = await supabase
    .from('courses')
    .select('approval_status')
    .eq('id', id)
    .single()

  if (!existing) throw new Error('Course not found')
  if (!isAcademicHead && !['pending', 'sent_back'].includes(existing.approval_status)) {
    throw new Error('Can only edit pending or sent-back courses')
  }

  const { data, error } = await supabase
    .from('courses')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update course: ${error.message}`)
  return data
}

export async function getCoursesForFacultyBooking(
  supabase: SupabaseClient,
  userId: string,
  termId?: string
): Promise<FacultyCourseResponse> {
  // Get active term if not provided
  let activeTermId = termId
  if (!activeTermId) {
    const { data: activeTerm } = await supabase
      .from('academic_terms')
      .select('id')
      .eq('is_active', true)
      .single()
    activeTermId = activeTerm?.id
  }

  if (!activeTermId) {
    // No active term — fall back to all active departments with empty courses
    const { data: allDepts } = await supabase
      .from('departments')
      .select('code, name')
      .eq('is_active', true)
      .order('code')
    return {
      departments: (allDepts ?? []).map(d => ({
        department_code: d.code,
        department_name: d.name,
        assigned_courses: [],
        other_courses: [],
      }))
    }
  }

  // Get departments from faculty's class schedules
  const { data: schedules } = await supabase
    .from('class_schedules')
    .select('department_id, course_code, departments(code, name)')
    .eq('instructor_id', userId)
    .eq('academic_term_id', activeTermId)
    .eq('is_active', true)

  const assignedCoursesByDept = new Map<string, Set<string>>()
  const deptNames = new Map<string, string>()

  for (const sched of schedules ?? []) {
    const dept = sched.departments as any
    if (!dept?.code) continue
    deptNames.set(dept.code, dept.name)
    if (!assignedCoursesByDept.has(dept.code)) assignedCoursesByDept.set(dept.code, new Set())
    if (sched.course_code) assignedCoursesByDept.get(dept.code)!.add(sched.course_code)
  }

  // Get all active term offerings for those departments
  const deptCodes = Array.from(deptNames.keys())
  if (deptCodes.length === 0) {
    // No class schedules — fall back to all active departments with approved courses
    const { data: allDepts } = await supabase
      .from('departments')
      .select('code, name')
      .eq('is_active', true)
      .order('code')

    const allDeptCodes = (allDepts ?? []).map(d => d.code)

    const { data: allApproved } = await supabase
      .from('courses')
      .select('id, course_code, course_name, delivery_mode, units, year_level, term, department_code, is_elective, elective_type')
      .eq('approval_status', 'approved')
      .in('department_code', allDeptCodes)

    return {
      departments: (allDepts ?? []).map(d => ({
        department_code: d.code,
        department_name: d.name,
        assigned_courses: [],
        other_courses: (allApproved ?? [])
          .filter(c => c.department_code === d.code)
          .map(c => ({
            id: c.id,
            course_code: c.course_code,
            course_name: c.course_name,
            delivery_mode: c.delivery_mode,
            units: c.units,
            year_level: c.year_level,
            term: c.term,
            is_elective: c.is_elective,
            elective_type: c.elective_type,
          })),
      }))
    }
  }

  // Always include the faculty's home department, even if they don't teach there this term
  const { data: userRow } = await supabase
    .from('users')
    .select('departments:department_id(code, name)')
    .eq('id', userId)
    .single()

  const homeDept = (userRow?.departments as any) as { code?: string; name?: string } | null
  if (homeDept?.code && !deptNames.has(homeDept.code)) {
    deptNames.set(homeDept.code, homeDept.name ?? homeDept.code)
  }

  const deptCodesWithHome = Array.from(deptNames.keys())

  // Map termId to the courses.term slot (1 = 1st Sem, 2 = 2nd Sem, 3 = Summer/Midyear)
  let termNumber: 1 | 2 | 3 = 1
  if (activeTermId) {
    const { data: term } = await supabase
      .from('academic_terms')
      .select('term_type')
      .eq('id', activeTermId)
      .single()
    termNumber = termTypeToNumber(term?.term_type)
  }

  // Get active courses for the term
  const { data: termCourses } = await supabase
    .from('courses')
    .select('id, course_code, course_name, delivery_mode, units, year_level, term, department_code, is_elective, elective_type')
    .eq('approval_status', 'approved')
    .eq('is_active', true)
    .eq('term', termNumber)
    .in('department_code', deptCodesWithHome)

  const departments = deptCodesWithHome.map(deptCode => {
    const assignedCodes = assignedCoursesByDept.get(deptCode) ?? new Set()

    const deptCourses = (termCourses ?? []).filter(c => c.department_code === deptCode)

    const assigned: CourseListItem[] = []
    const other: CourseListItem[] = []

    for (const c of deptCourses) {
      const item: CourseListItem = {
        id: c.id,
        course_code: c.course_code,
        course_name: c.course_name,
        delivery_mode: c.delivery_mode,
        units: c.units,
        year_level: c.year_level,
        term: c.term,
        is_elective: c.is_elective,
        elective_type: c.elective_type,
      }
      if (assignedCodes.has(c.course_code)) {
        assigned.push(item)
      } else {
        other.push(item)
      }
    }

    return {
      department_code: deptCode,
      department_name: deptNames.get(deptCode) ?? deptCode,
      assigned_courses: assigned,
      other_courses: other,
    }
  })

  return { departments }
}
