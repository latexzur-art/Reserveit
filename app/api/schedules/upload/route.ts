/**
 * POST /api/schedules/upload
 * Program Head uploads a CSV file → parse → validate → conflict detect → return summary
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
import { parseCsvText } from '@/backend/schedule/csvParser'
import { validateAndEnrichEntry } from '@/backend/schedule/entryValidator'
import { detectAllConflicts } from '@/backend/schedule/conflictDetector'
import { notifyCrossDeptConflicts } from '@/backend/schedule/conflictNotifier'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeDbError } from '@/lib/errors'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME_TYPES = ['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/octet-stream']

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireProgramHead()
  if (authError) return authError

  const rateLimited = checkRateLimit(`schedule-upload:${user.id}`, RATE_LIMITS.SCHEDULE_UPLOAD)
  if (rateLimited) return rateLimited

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const academicTermId = formData.get('academic_term_id') as string | null

  if (!file) {
    return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
  }

  // File size validation
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` },
      { status: 400 }
    )
  }

  // File type validation
  if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.endsWith('.csv')) {
    return NextResponse.json(
      { error: 'Only CSV files are accepted' },
      { status: 400 }
    )
  }

  if (!academicTermId) {
    return NextResponse.json({ error: 'academic_term_id is required' }, { status: 400 })
  }

  const departmentId = (user as any).department_id as string | null
  if (!departmentId) {
    return NextResponse.json({ error: 'Your account is not associated with a department' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 1. Create upload record
  const { data: upload, error: uploadError } = await supabase
    .from('schedule_uploads')
    .insert({
      academic_term_id: academicTermId,
      department_id: departmentId,
      upload_mode: 'file_upload',
      upload_status: 'parsing',
      source_file_name: file.name,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (uploadError) {
    if (uploadError.message.includes('schedule_uploads_one_active_per_dept_term_idx')) {
      return NextResponse.json(
        { error: 'Your department already has a pending schedule upload for this term. Complete or cancel it first.' },
        { status: 409 }
      )
    }
    console.error('[POST /api/schedules/upload] Insert upload error:', uploadError.message)
    return NextResponse.json({ error: sanitizeDbError(uploadError) }, { status: 500 })
  }

  const uploadId = upload.id

  // Helper to mark upload as failed and clean up staging entries on error
  async function failUpload(reason: string) {
    await supabase
      .from('schedule_entries_staging')
      .delete()
      .eq('schedule_upload_id', uploadId)
    await supabase
      .from('schedule_uploads')
      .update({ upload_status: 'failed', parse_error_message: reason })
      .eq('id', uploadId)
  }

  try {
    // 2. Parse CSV
    const csvText = await file.text()
    const { rows: rawRows, errors: parseErrors } = parseCsvText(csvText)

    if (rawRows.length === 0) {
      await supabase
        .from('schedule_uploads')
        .update({ upload_status: 'validation_failed', parse_error_message: parseErrors.join('; ') })
        .eq('id', uploadId)

      return NextResponse.json(
        { error: 'No valid rows found in CSV', parse_errors: parseErrors },
        { status: 422 }
      )
    }

    // 3. Validate + match each entry
    const supabaseAdmin = createAdminClient()
    const parsedEntries = []
    for (const raw of rawRows) {
      const entry = await validateAndEnrichEntry(supabaseAdmin, raw)
      parsedEntries.push(entry)
    }

    // --- Duration Aggregation (Fix for split schedules) ---
    try {
      const timeToMins = (t: string) => {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + (m || 0)
      }

      const courseCodes = Array.from(new Set(parsedEntries.map(e => e.course_code).filter(Boolean)))
      const { data: coursesData } = await supabaseAdmin
        .from('courses')
        .select('course_code, lecture_hours, lab_hours, delivery_mode')
        .in('course_code', courseCodes)

      const courseMap = new Map(coursesData?.map(c => [c.course_code, c]) || [])
      const groups: Record<string, { totalMins: number; expectedMins: number; entries: any[] }> = {}

      for (const entry of parsedEntries) {
        if (!entry.course_code || !entry.section || entry.validation_status === 'error') continue
        
        const course = courseMap.get(entry.course_code)
        if (!course) continue

        const type = entry.session_type || (course.delivery_mode === 'lab' ? 'lab' : 'lecture')
        const expectedHours = type === 'lab' ? course.lab_hours : course.lecture_hours
        if (!expectedHours) continue

        const key = `${entry.course_code}|${entry.section}|${type}`
        if (!groups[key]) {
          groups[key] = { totalMins: 0, expectedMins: expectedHours * 60, entries: [] }
        }

        const duration = timeToMins(entry.end_time) - timeToMins(entry.start_time)
        groups[key].totalMins += duration
        groups[key].entries.push(entry)
      }

      for (const key in groups) {
        const group = groups[key]
        if (group.totalMins >= group.expectedMins) {
          for (const entry of group.entries) {
            entry.validation_warnings = (entry.validation_warnings as any[]).filter(
              (w: any) => w.code !== 'DURATION_UNDER_HOURS'
            )
            if (entry.validation_warnings.length === 0 && entry.validation_status === 'warning') {
              entry.validation_status = 'valid'
            }
          }
        }
      }
    } catch (aggErr) {
      console.error('[Batch Duration Aggregation Error]:', aggErr)
    }

    // 4. Bulk insert entries into staging
    const insertPayload = parsedEntries.map((entry) => ({
      schedule_upload_id: uploadId,
      entry_source: 'file_parsed' as const,
      row_number: entry.row_number,
      facility_id: entry.facility_id,
      facility_name_raw: entry.facility_name_raw,
      facility_match_confidence: entry.facility_match_confidence,
      course_code: entry.course_code,
      course_name: entry.course_name || entry.course_code,
      section: entry.section,
      instructor_id: entry.instructor_id,
      instructor_name: entry.instructor_name || 'TBD',
      day_of_week: entry.day_of_week,
      start_time: entry.start_time,
      end_time: entry.end_time,
      effective_start_date: entry.effective_start_date,
      effective_end_date: entry.effective_end_date,
      session_type: entry.session_type ?? null,
      validation_status: entry.validation_status,
      validation_errors: entry.validation_errors as unknown as object[],
      validation_warnings: entry.validation_warnings as unknown as object[],
    }))

    const { error: insertError } = await supabase
      .from('schedule_entries_staging')
      .insert(insertPayload)

    if (insertError) {
      console.error('[POST /api/schedules/upload] Insert entries error:', insertError.message)
      await failUpload(`Staging insert failed: ${insertError.message}`)
      return NextResponse.json({ error: sanitizeDbError(insertError) }, { status: 500 })
    }

    // 5. Re-validate section overlaps across the batch (internal/external validation errors)


    // 6. Detect conflicts
    let conflict_count = 0
    try {
      const result = await detectAllConflicts(supabase, uploadId)
      conflict_count = result.conflict_count
    } catch (conflictErr) {
      console.error('[POST /api/schedules/upload] Conflict detection error:', conflictErr)
      // Don't fail the upload — entries are already staged, just note 0 conflicts
    }

    // 7. Update upload summary counts based on database validation status
    const { data: updatedEntries } = await supabase
      .from('schedule_entries_staging')
      .select('validation_status')
      .eq('schedule_upload_id', uploadId)
    
    const valid = updatedEntries?.filter((e) => e.validation_status === 'valid').length ?? 0
    const warnings = updatedEntries?.filter((e) => e.validation_status === 'warning').length ?? 0
    const errors = updatedEntries?.filter((e) => e.validation_status === 'error').length ?? 0

    await supabase
      .from('schedule_uploads')
      .update({
        upload_status: errors > 0 ? 'validation_failed' : 'pending_submission',
        parse_completed_at: new Date().toISOString(),
        total_entries: parsedEntries.length,
        valid_entries_count: valid,
        warning_entries_count: warnings,
        error_entries_count: errors,
        conflict_count,
      })
      .eq('id', uploadId)

    // 8. Notify cross-dept conflicts
    if (conflict_count > 0) {
      await notifyCrossDeptConflicts(supabase, uploadId)
    }

    return NextResponse.json({
      upload_id: uploadId,
      total: parsedEntries.length,
      valid,
      warnings,
      errors,
      conflict_count,
      parse_errors: parseErrors,
      can_submit: errors === 0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[POST /api/schedules/upload] Unexpected error:', message)
    await failUpload(message)
    return NextResponse.json({ error: 'Schedule upload failed. Please try again.' }, { status: 500 })
  }
}
