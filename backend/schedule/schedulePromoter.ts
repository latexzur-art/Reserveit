/**
 * Schedule Promoter
 * Moves Academic Head-approved staging entries into the live class_schedules table.
 * @module backend/schedule/schedulePromoter
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PromotionResult } from './schedule.types'

/**
 * Promotes all academic_head_approved entries for an upload into class_schedules.
 * Called after Academic Head finalizes review.
 */
export async function promoteApprovedEntries(
  supabase: SupabaseClient,
  uploadId: string
): Promise<PromotionResult> {
  // Get upload metadata
  const { data: upload } = await supabase
    .from('schedule_uploads')
    .select('academic_term_id, department_id')
    .eq('id', uploadId)
    .single()

  if (!upload) {
    return { promoted_count: 0, skipped_count: 0, errors: ['Upload not found'] }
  }

  // Get the academic term's date range for fallback effective dates
  const { data: term } = await supabase
    .from('academic_terms')
    .select('start_date, end_date')
    .eq('id', upload.academic_term_id)
    .single()

  // Get all academic_head_approved entries that have a resolved facility
  const { data: approvedEntries } = await supabase
    .from('schedule_entries_staging')
    .select('*')
    .eq('schedule_upload_id', uploadId)
    .eq('academic_head_review_status', 'academic_head_approved')
    .not('facility_id', 'is', null)

  if (!approvedEntries || approvedEntries.length === 0) {
    return { promoted_count: 0, skipped_count: 0, errors: [] }
  }

  let promotedCount = 0
  let skippedCount = 0
  const errors: string[] = []

  for (const entry of approvedEntries) {
    const { error } = await supabase
      .from('class_schedules')
      .insert({
        schedule_upload_id: uploadId,
        staging_entry_id: entry.id,
        academic_term_id: upload.academic_term_id,
        department_id: upload.department_id,
        facility_id: entry.facility_id,
        course_code: entry.course_code,
        course_name: entry.course_name,
        section: entry.section,
        instructor_id: entry.instructor_id,
        instructor_name: entry.instructor_name,
        day_of_week: entry.day_of_week,
        start_time: entry.start_time,
        end_time: entry.end_time,
        effective_start_date: entry.effective_start_date ?? term?.start_date ?? null,
        effective_end_date: entry.effective_end_date ?? term?.end_date ?? null,
        is_active: true,
        version: 1,
      })

    if (error) {
      skippedCount++
      const isConflict = error.code === '23505' || error.message.includes('Class schedule conflict')
      const message = isConflict
        ? `Row ${entry.row_number}: Time conflict — another active schedule already occupies this facility and time slot`
        : `Row ${entry.row_number}: ${error.message}`
      errors.push(message)
    } else {
      promotedCount++
    }
  }

  // Update upload status
  const { count: remainingPending } = await supabase
    .from('schedule_entries_staging')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_upload_id', uploadId)
    .in('academic_head_review_status', ['academic_head_flagged', 'pending_review'])

  const newStatus = (remainingPending ?? 0) === 0 ? 'approved' : 'partially_approved'

  await supabase
    .from('schedule_uploads')
    .update({ upload_status: newStatus })
    .eq('id', uploadId)

  return { promoted_count: promotedCount, skipped_count: skippedCount, errors }
}
