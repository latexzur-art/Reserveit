/**
 * PATCH /api/schedules/uploads/[id]/entries/[entryId]
 * Program Head edits a staging entry → re-validate → re-detect conflicts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { sanitizeDbError } from '@/lib/errors'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
import { validateAndEnrichEntry } from '@/backend/schedule/entryValidator'
import { detectAllConflicts } from '@/backend/schedule/conflictDetector'
import { clearFacilityCache } from '@/backend/schedule/facilityMatcher'
import type { RawCsvRow } from '@/backend/schedule/schedule.types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { error: authError, user } = await requireProgramHead()
  if (authError) return authError

  const { id: uploadId, entryId } = await params
  const body = await request.json()

  const supabase = createAdminClient()

  // Verify upload ownership
  const { data: upload } = await supabase
    .from('schedule_uploads')
    .select('uploaded_by, upload_status')
    .eq('id', uploadId)
    .single()

  if (!upload || upload.uploaded_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const editableStatuses = ['draft', 'validation_failed', 'pending_submission', 'revision_requested']
  if (!editableStatuses.includes(upload.upload_status)) {
    return NextResponse.json(
      { error: 'Upload cannot be edited in its current status' },
      { status: 409 }
    )
  }

  // Get current entry
  const { data: existingEntry } = await supabase
    .from('schedule_entries_staging')
    .select('*')
    .eq('id', entryId)
    .eq('schedule_upload_id', uploadId)
    .single()

  if (!existingEntry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  // Build raw row from existing + updated fields
  const rawRow: RawCsvRow = {
    row_number: existingEntry.row_number,
    course_code: body.course_code ?? existingEntry.course_code,
    course_name: body.course_name ?? existingEntry.course_name,
    section: body.section ?? existingEntry.section,
    facility_name: body.facility_name_raw ?? existingEntry.facility_name_raw,
    instructor_name: body.instructor_name ?? existingEntry.instructor_name,
    day_of_week_raw: body.day_of_week != null ? String(body.day_of_week) : String(existingEntry.day_of_week),
    start_time_raw: body.start_time ?? existingEntry.start_time,
    end_time_raw: body.end_time ?? existingEntry.end_time,
    effective_start_date_raw: body.effective_start_date ?? existingEntry.effective_start_date,
    effective_end_date_raw: body.effective_end_date ?? existingEntry.effective_end_date,
  }

  // Clear facility cache if facility name changed
  if (body.facility_name_raw) {
    clearFacilityCache()
  }

  // Fetch strict instructor requirement setting
  const { data: settingRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'strict_instructor_requirement')
    .single()
  
  const strictInstructorRequirement = settingRow?.value === true

  const validated = await validateAndEnrichEntry(supabase, rawRow, { strictInstructorRequirement })

  // Update the staging entry
  const { error: updateError } = await supabase
    .from('schedule_entries_staging')
    .update({
      facility_id: validated.facility_id,
      facility_name_raw: validated.facility_name_raw,
      facility_match_confidence: validated.facility_match_confidence,
      course_code: validated.course_code,
      course_name: validated.course_name || validated.course_code,
      section: validated.section,
      instructor_id: validated.instructor_id,
      instructor_name: validated.instructor_name || 'TBD',
      day_of_week: validated.day_of_week,
      start_time: validated.start_time,
      end_time: validated.end_time,
      effective_start_date: validated.effective_start_date,
      effective_end_date: validated.effective_end_date,
      validation_status: validated.validation_status,
      validation_errors: validated.validation_errors as unknown as object[],
      validation_warnings: validated.validation_warnings as unknown as object[],
    })
    .eq('id', entryId)

  if (updateError) {
    console.error('[PATCH /api/schedules/uploads/.../entries/...]', updateError.message)
    return NextResponse.json({ error: sanitizeDbError(updateError) }, { status: 500 })
  }

  // Re-run conflict detection for the whole upload to clear stale flags on other entries
  if (validated.facility_id || validated.instructor_id || validated.section) {
    await detectAllConflicts(supabase, uploadId)
  }

  // Refresh upload counts
  await supabase.rpc('update_upload_counts', { p_upload_id: uploadId })

  return NextResponse.json({ success: true, entry: validated })
}
