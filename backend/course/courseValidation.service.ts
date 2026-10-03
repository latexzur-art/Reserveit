/**
 * Course Validation Service
 * Validates course entries before insertion into the catalog.
 * @module backend/course/courseValidation.service
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CourseCreateInput, CourseValidationResult, ValidationIssue, CourseTemplateRow } from '@/types/course.types'

const COURSE_CODE_REGEX = /^[A-Z0-9]{4,20}$/

function normalize(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return [...v].sort().join(',')
  return String(v).trim()
}

function coursesAreIdentical(input: CourseCreateInput, existing: Record<string, any>): boolean {
  const fields: (keyof CourseCreateInput)[] = [
    'course_name', 'units', 'year_level', 'term', 'delivery_mode',
    'lecture_hours', 'lab_hours', 'is_elective', 'elective_type',
    'description', 'prerequisite_codes',
  ]
  return fields.every(f => normalize(input[f]) === normalize(existing[f]))
}

const EXISTING_COURSE_COLUMNS = 'course_name, units, year_level, term, delivery_mode, lecture_hours, lab_hours, is_elective, elective_type, description, prerequisite_codes, approval_status'

export async function validateCourse(
  supabase: SupabaseClient,
  input: CourseCreateInput,
  opts?: {
    skipDuplicateCheck?: boolean
    /** Pass these when validating many rows at once (see validateBatch) to skip the
     * per-row department/duplicate lookups in favor of one bulk query upfront. */
    departmentExists?: boolean
    existingCourse?: Record<string, any> | null
    /** The batch's Year Level / Semester label (from the Upload step's dropdowns), if any.
     * null/undefined means "Mixed / All" — no per-row check applies. */
    labelYearLevel?: number | null
    labelTerm?: number | null
  }
): Promise<CourseValidationResult> {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  // department_code exists
  const deptExists = opts?.departmentExists !== undefined
    ? opts.departmentExists
    : !!(await supabase.from('departments').select('code').eq('code', input.department_code).maybeSingle()).data

  if (!deptExists) {
    errors.push({ field: 'department_code', message: `Department "${input.department_code}" does not exist` })
  }

  // course_code format
  if (!COURSE_CODE_REGEX.test(input.course_code)) {
    errors.push({ field: 'course_code', message: 'Course code must be 4-20 alphanumeric characters (uppercase)' })
  }

  // uniqueness check
  if (!opts?.skipDuplicateCheck) {
    const existing = opts?.existingCourse !== undefined
      ? opts.existingCourse
      : (await supabase
          .from('courses')
          .select(EXISTING_COURSE_COLUMNS)
          .eq('department_code', input.department_code)
          .eq('course_code', input.course_code)
          .limit(1)
          .single()).data

    if (existing) {
      if (coursesAreIdentical(input, existing)) {
        // Harmless no-op duplicate — skipped, but never blocks the rest of the batch.
        errors.push({ field: 'duplicate_identical', message: 'This course is identical to the existing record in the catalog — no changes needed.' })
      } else if (existing.approval_status === 'approved') {
        errors.push({ field: 'duplicate_conflict', message: 'This course already exists and is approved with different values. Edit the existing course directly instead of re-uploading it.' })
      } else {
        warnings.push({ field: 'course_code', message: `Course "${input.course_code}" already exists in department "${input.department_code}". Uploading will update the existing record.` })
      }
    }
  }

  // units
  if (!Number.isInteger(input.units) || input.units <= 0) {
    errors.push({ field: 'units', message: 'Units must be a positive integer' })
  }

  // year_level
  if (input.year_level < 1 || input.year_level > 4) {
    errors.push({ field: 'year_level', message: 'Year level must be between 1 and 4' })
  }

  // term (1 = 1st Sem, 2 = 2nd Sem, 3 = Summer/Midyear)
  if (input.term !== 1 && input.term !== 2 && input.term !== 3) {
    errors.push({ field: 'term', message: 'Term must be 1, 2, or 3 (Summer/Midyear)' })
  }

  // year_level/term must match the batch's selected label, if one was given
  if (opts?.labelYearLevel != null && input.year_level !== opts.labelYearLevel) {
    errors.push({ field: 'year_term_mismatch', message: `This row is Year ${input.year_level}, but the upload was labeled Year ${opts.labelYearLevel}. Fix the row or re-upload under the correct label.` })
  }
  if (opts?.labelTerm != null && input.term !== opts.labelTerm) {
    const termName = (t: number) => t === 1 ? '1st Semester' : t === 2 ? '2nd Semester' : 'Summer/Midyear'
    errors.push({ field: 'year_term_mismatch', message: `This row is ${termName(input.term)}, but the upload was labeled ${termName(opts.labelTerm)}. Fix the row or re-upload under the correct label.` })
  }

  // delivery_mode
  if (!['lecture', 'lab', 'both', 'practicum'].includes(input.delivery_mode)) {
    errors.push({ field: 'delivery_mode', message: 'Delivery mode must be lecture, lab, both, or practicum' })
  }

  // hours validation based on delivery_mode (practicum has no lecture/lab hours)
  if ((input.delivery_mode === 'lecture' || input.delivery_mode === 'both') && !input.lecture_hours) {
    errors.push({ field: 'lecture_hours', message: 'Lecture hours required when delivery mode includes lectures' })
  }
  if ((input.delivery_mode === 'lab' || input.delivery_mode === 'both') && !input.lab_hours) {
    errors.push({ field: 'lab_hours', message: 'Lab hours required when delivery mode includes labs' })
  }

  // Removed prerequisite warnings as requested

  // Elective courses must have an explicit name/type (mandatory confirmation gate)
  if (input.is_elective && !input.elective_type?.trim()) {
    errors.push({
      field: 'elective_type',
      message: 'This course is marked as an Elective — please specify the elective name/type (e.g. "Web Development", "AI & Machine Learning Track") before continuing.',
    })
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function parseTemplateRow(row: CourseTemplateRow, rowNumber: number): { input: CourseCreateInput | null; errors: ValidationIssue[] } {
  const errors: ValidationIssue[] = []

  const units = typeof row.units === 'string' ? parseInt(row.units, 10) : row.units
  const yearLevel = typeof row.year_level === 'string' ? parseInt(row.year_level, 10) : row.year_level
  const term = typeof row.term === 'string' ? parseInt(row.term, 10) : row.term
  const lectureHours = row.lecture_hours ? (typeof row.lecture_hours === 'string' ? parseFloat(row.lecture_hours) : row.lecture_hours) : null
  const labHours = row.lab_hours ? (typeof row.lab_hours === 'string' ? parseFloat(row.lab_hours) : row.lab_hours) : null

  if (!row.department_code?.trim()) errors.push({ field: 'department_code', message: 'Department code is required', row: rowNumber })
  if (!row.course_code?.trim()) errors.push({ field: 'course_code', message: 'Course code is required', row: rowNumber })
  if (!row.course_name?.trim()) errors.push({ field: 'course_name', message: 'Course name is required', row: rowNumber })
  if (isNaN(units)) errors.push({ field: 'units', message: 'Invalid units value', row: rowNumber })
  if (isNaN(yearLevel)) errors.push({ field: 'year_level', message: 'Invalid year level', row: rowNumber })
  if (isNaN(term)) errors.push({ field: 'term', message: 'Invalid term', row: rowNumber })

  const modeMap: Record<string, 'lecture' | 'lab' | 'both' | 'practicum'> = {
    lecture: 'lecture',
    lab: 'lab',
    both: 'both',
    'lab/lecture': 'both',
    'lecture/lab': 'both',
    practicum: 'practicum',
  }
  const deliveryMode = modeMap[row.delivery_mode?.trim().toLowerCase() ?? '']
  if (!deliveryMode) {
    errors.push({ field: 'delivery_mode', message: 'Delivery mode must be Lecture, Lab, Lab/Lecture, or Practicum', row: rowNumber })
  }

  if (errors.length > 0) return { input: null, errors }

  const prerequisiteCodes = row.prerequisite_codes
    ? row.prerequisite_codes.split(/[,;]/).map(s => s.trim()).filter(Boolean)
    : undefined

  const isElective = typeof row.is_elective === 'string'
    ? ['true', 'yes', '1'].includes(row.is_elective.toLowerCase())
    : !!row.is_elective

  const electiveType = row.elective_type?.trim() || undefined

  return {
    input: {
      department_code: row.department_code.trim().toUpperCase(),
      course_code: row.course_code.trim().toUpperCase(),
      course_name: row.course_name.trim(),
      units,
      year_level: yearLevel,
      term,
      delivery_mode: deliveryMode!,
      lecture_hours: lectureHours,
      lab_hours: labHours,
      prerequisite_codes: prerequisiteCodes,
      is_elective: isElective,
      elective_type: electiveType,
      description: row.description?.trim() || undefined,
    },
    errors: [],
  }
}

export async function validateBatch(
  supabase: SupabaseClient,
  rows: CourseCreateInput[],
  opts?: { labelYearLevel?: number | null; labelTerm?: number | null }
): Promise<{ results: (CourseValidationResult & { row: number })[]; hasErrors: boolean }> {
  // Pre-compute in-batch duplicate keys before running parallel validation
  const seenCodes = new Set<string>()
  const duplicateKeys = new Set<string>()
  for (const row of rows) {
    const key = `${row.department_code}:${row.course_code}`
    if (seenCodes.has(key)) duplicateKeys.add(key)
    seenCodes.add(key)
  }

  // Bulk-prefetch department existence + existing courses for the whole batch up front,
  // instead of validateCourse re-querying both per row (N rows → 2 queries vs. up to 2N).
  const deptCodes = [...new Set(rows.map(r => r.department_code))]
  const courseCodes = [...new Set(rows.map(r => r.course_code))]

  const [{ data: depts }, { data: existingCourses }] = await Promise.all([
    deptCodes.length
      ? supabase.from('departments').select('code').in('code', deptCodes)
      : Promise.resolve({ data: [] as { code: string }[] }),
    (deptCodes.length && courseCodes.length)
      ? supabase.from('courses').select(`department_code, course_code, ${EXISTING_COURSE_COLUMNS}`).in('department_code', deptCodes).in('course_code', courseCodes)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const deptSet = new Set((depts ?? []).map((d: any) => d.code))
  const existingMap = new Map((existingCourses ?? []).map((c: any) => [`${c.department_code}::${c.course_code}`, c]))

  // Validate all rows in parallel, using the prefetched lookups instead of per-row queries
  const settled = await Promise.all(
    rows.map(async (row, i) => {
      const result = await validateCourse(supabase, row, {
        departmentExists: deptSet.has(row.department_code),
        existingCourse: existingMap.get(`${row.department_code}::${row.course_code}`) ?? null,
        labelYearLevel: opts?.labelYearLevel,
        labelTerm: opts?.labelTerm,
      })
      const key = `${row.department_code}:${row.course_code}`
      if (duplicateKeys.has(key)) {
        result.errors.push({ field: 'course_code', message: `Duplicate course "${row.course_code}" in batch`, row: i + 1 })
        result.valid = false
      }
      return { ...result, row: i + 1 }
    })
  )

  const hasErrors = settled.some(r => !r.valid)
  return { results: settled, hasErrors }
}
