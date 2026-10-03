/**
 * Course Approval — auto-activation of staged schedule entries once a
 * course is approved (clears COURSE_NOT_IN_CATALOG / COURSE_PENDING_APPROVAL).
 * @module backend/course/courseActivation
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export async function onCourseApproved(
  supabase: SupabaseClient,
  courseId: string
): Promise<void> {
  // Get the course details
  const { data: course } = await supabase
    .from('courses')
    .select('course_code, department_code')
    .eq('id', courseId)
    .single()

  if (!course) return

  // Find schedule staging entries that reference this course code within the same department
  const { data: stagingEntries } = await supabase
    .from('schedule_entries_staging')
    .select('id, validation_warnings, validation_errors')
    .eq('course_code', course.course_code)
    .eq('department_code', course.department_code)
    .in('validation_status', ['warning', 'error'])

  if (!stagingEntries?.length) return

  // COURSE_NOT_IN_CATALOG lives in validation_errors and COURSE_PENDING_APPROVAL
  // in validation_warnings — both are resolved by the approval, so filter both
  // arrays and recompute the status from what remains.
  const COURSE_CODES = new Set(['COURSE_NOT_IN_CATALOG', 'COURSE_PENDING_APPROVAL'])
  const nowValid: string[] = []
  const stillProblematic: { id: string; warnings: any[]; errors: any[]; status: 'warning' | 'error' }[] = []

  for (const entry of stagingEntries) {
    const warnings = ((entry.validation_warnings ?? []) as any[]).filter((w: any) => !COURSE_CODES.has(w.code))
    const errors = ((entry.validation_errors ?? []) as any[]).filter((e: any) => !COURSE_CODES.has(e.code))
    if (errors.length === 0 && warnings.length === 0) {
      nowValid.push(entry.id)
    } else {
      stillProblematic.push({ id: entry.id, warnings, errors, status: errors.length > 0 ? 'error' : 'warning' })
    }
  }

  // Batch-update entries that are now fully valid
  if (nowValid.length > 0) {
    await supabase
      .from('schedule_entries_staging')
      .update({ validation_warnings: [], validation_errors: [], validation_status: 'valid' })
      .in('id', nowValid)
  }

  // Remaining entries still have issues — update each individually (filtered lists differ per row)
  await Promise.all(
    stillProblematic.map(({ id, warnings, errors, status }) =>
      supabase
        .from('schedule_entries_staging')
        .update({ validation_warnings: warnings, validation_errors: errors, validation_status: status })
        .eq('id', id)
    )
  )
}
