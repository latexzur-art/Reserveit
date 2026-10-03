import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
import { validateAndEnrichEntry, revalidateUploadHours } from '@/backend/schedule/entryValidator'
import { detectConflicts } from '@/backend/schedule/conflictDetector'
import { updateUploadCounts } from '@/backend/schedule/uploadCountUpdater'
import type { RawCsvRow } from '@/backend/schedule/schedule.types'

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ uploadId: string, entryId: string }> }
) {
    const { error: authError } = await requireProgramHead()
    if (authError) return authError

    const params = await context.params
    const uploadId = params.uploadId
    const entryId = params.entryId

    const body = await request.json()

    const supabase = createAdminClient()

    // Get existing entry to preserve row_number
    const { data: existing, error: fetchErr } = await supabase
        .from('schedule_entries_staging')
        .select('row_number, effective_start_date, effective_end_date, is_published')
        .eq('id', entryId)
        .eq('schedule_upload_id', uploadId)
        .single()

    if (fetchErr || !existing) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // A published entry already has a live class_schedules row. Editing its staging
    // copy would silently diverge the two — block it (mirrors the DELETE guard).
    if (existing.is_published) {
        return NextResponse.json({ error: 'Cannot edit a published entry' }, { status: 409 })
    }

    // Prepare raw row for re-validation
    const rawRow: RawCsvRow = {
        row_number: existing.row_number,
        course_code: body.course_code,
        course_name: body.course_name,
        section: body.section,
        facility_name: body.facility_name_raw,
        instructor_name: body.instructor_name,
        day_of_week_raw: String(body.day_of_week), // we can just pass the day logic
        start_time_raw: body.start_time,
        end_time_raw: body.end_time,
        session_type_raw: body.session_type,
    }

    // Map the numeric day of week back to string for the parser if necessary
    const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    if (typeof body.day_of_week === 'number' && body.day_of_week >= 0 && body.day_of_week <= 6) {
        rawRow.day_of_week_raw = dayMap[body.day_of_week]
    }

    // Fetch strict instructor requirement setting
    const { data: settingRow } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'strict_instructor_requirement')
        .single()
    
    const strictInstructorRequirement = settingRow?.value === true

    // Re-run validation
    const parsed = await validateAndEnrichEntry(supabase, rawRow, { strictInstructorRequirement })

    // Preserve existing effective dates if not provided in update
    parsed.effective_start_date = parsed.effective_start_date ?? existing.effective_start_date
    parsed.effective_end_date = parsed.effective_end_date ?? existing.effective_end_date

    // Update in database (conflict flags will be set by detectConflicts below)
    const { data: updated, error: updateErr } = await supabase
        .from('schedule_entries_staging')
        .update({
            course_code: parsed.course_code,
            course_name: parsed.course_name,
            section: parsed.section,
            session_type: parsed.session_type,
            facility_name_raw: parsed.facility_name_raw,
            facility_id: parsed.facility_id,
            facility_match_confidence: parsed.facility_match_confidence,
            instructor_name: parsed.instructor_name,
            instructor_id: parsed.instructor_id,
            day_of_week: parsed.day_of_week,
            start_time: parsed.start_time,
            end_time: parsed.end_time,
            effective_start_date: parsed.effective_start_date,
            effective_end_date: parsed.effective_end_date,
            validation_status: parsed.validation_status,
            validation_errors: parsed.validation_errors,
            validation_warnings: parsed.validation_warnings,
            // Initially clear — detectConflicts will set the real values
            has_internal_conflict: false,
            has_external_conflict: false,
        })
        .eq('id', entryId)
        .select(`
            *,
            facilities (name, room_number)
        `)
        .single()

    if (updateErr || !updated) {
        console.error('[PUT /api/schedules/review/.../entries/[entryId]] Error:', updateErr?.message)
        return NextResponse.json({ error: updateErr?.message || 'Update failed' }, { status: 500 })
    }

    // Re-run conflict detection
    let conflicts: any[] = []
    if (parsed.facility_id || parsed.instructor_id || parsed.section) {
        conflicts = await detectConflicts(
            supabase,
            uploadId,
            entryId,
            parsed.facility_id,
            parsed.instructor_id,
            parsed.section || '',
            parsed.day_of_week,
            parsed.start_time,
            parsed.end_time,
            parsed.facility_name_raw,
            parsed.instructor_name
        )
    }

    // 4. Re-validate hours for the whole batch
    await revalidateUploadHours(supabase, uploadId)

    // Re-read the entry to get updated conflict flags and validation errors
    const { data: refreshed } = await supabase
        .from('schedule_entries_staging')
        .select(`*, facilities (name, room_number)`)
        .eq('id', entryId)
        .single()

    // 5. Update parent upload summary counts
    const counts = await updateUploadCounts(supabase, uploadId)

    // Clear stale conflict flags on OTHER entries now that this entry has moved/changed
    const { detectAllConflicts } = await import('@/backend/schedule/conflictDetector')
    await detectAllConflicts(supabase, uploadId)

    return NextResponse.json({
        ...(refreshed ?? updated),
        conflicts,
        upload_counts: counts,
    })
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ uploadId: string, entryId: string }> }
) {
    const { error: authError } = await requireProgramHead()
    if (authError) return authError

    const params = await context.params
    const uploadId = params.uploadId
    const entryId = params.entryId

    const supabase = createAdminClient()

    // Ensure it's not published
    const { data: existing, error: fetchErr } = await supabase
        .from('schedule_entries_staging')
        .select('is_published')
        .eq('id', entryId)
        .eq('schedule_upload_id', uploadId)
        .single()

    if (fetchErr || !existing) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    if (existing.is_published) {
        return NextResponse.json({ error: 'Cannot delete a published entry' }, { status: 400 })
    }

    const { error: deleteErr } = await supabase
        .from('schedule_entries_staging')
        .delete()
        .eq('id', entryId)

    if (deleteErr) {
        return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 })
    }

    // Update the counts on the parent upload
    await updateUploadCounts(supabase, uploadId)

    // Clear stale conflict flags
    const { detectAllConflicts } = await import('@/backend/schedule/conflictDetector')
    await detectAllConflicts(supabase, uploadId)

    return NextResponse.json({ success: true })
}

