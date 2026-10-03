import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
import { validateAndEnrichEntry } from '@/backend/schedule/entryValidator'
import { detectConflicts } from '@/backend/schedule/conflictDetector'
import { updateUploadCounts } from '@/backend/schedule/uploadCountUpdater'

/**
 * POST /api/schedules/review/[uploadId]/entries/split
 *
 * Splits one staging entry into two sessions:
 * - Updates the original entry with session1 schedule data
 * - Inserts a new staging entry for session2 (same course/section/instructor)
 * - Re-validates and conflict-checks both
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ uploadId: string }> }
) {
    const { error: authError } = await requireProgramHead()
    if (authError) return authError

    const { uploadId } = await context.params
    const body = await request.json()
    const { entry_id, session1, session2 } = body

    if (!entry_id || !session1 || !session2) {
        return NextResponse.json({ error: 'entry_id, session1, and session2 are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch the original entry
    const { data: original, error: fetchErr } = await supabase
        .from('schedule_entries_staging')
        .select('*')
        .eq('id', entry_id)
        .eq('schedule_upload_id', uploadId)
        .single()

    if (fetchErr || !original) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

    // Fetch strict instructor requirement setting
    const { data: settingRow } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'strict_instructor_requirement')
        .single()
    
    const strictInstructorRequirement = settingRow?.value === true

    // Validate both sessions (re-uses full validation pipeline)
    const [parsed1, parsed2] = await Promise.all([
        validateAndEnrichEntry(supabase, {
            row_number: original.row_number ?? 0,
            course_code: original.course_code,
            course_name: original.course_name,
            section: original.section,
            facility_name: session1.facility_name_raw,
            instructor_name: original.instructor_name,
            day_of_week_raw: dayMap[session1.day_of_week] ?? String(session1.day_of_week),
            start_time_raw: session1.start_time,
            end_time_raw: session1.end_time,
            effective_start_date_raw: original.effective_start_date ?? undefined,
            effective_end_date_raw: original.effective_end_date ?? undefined,
        }, { strictInstructorRequirement }),
        validateAndEnrichEntry(supabase, {
            row_number: original.row_number ?? 0,
            course_code: original.course_code,
            course_name: original.course_name,
            section: original.section,
            facility_name: session2.facility_name_raw,
            instructor_name: original.instructor_name,
            day_of_week_raw: dayMap[session2.day_of_week] ?? String(session2.day_of_week),
            start_time_raw: session2.start_time,
            end_time_raw: session2.end_time,
            effective_start_date_raw: original.effective_start_date ?? undefined,
            effective_end_date_raw: original.effective_end_date ?? undefined,
        }, { strictInstructorRequirement }),
    ])

    // Determine row_number for the new entry
    const { data: maxRow } = await supabase
        .from('schedule_entries_staging')
        .select('row_number')
        .eq('schedule_upload_id', uploadId)
        .order('row_number', { ascending: false })
        .limit(1)
        .maybeSingle()

    const newRowNumber = (maxRow?.row_number ?? 0) + 1

    // Update original entry → session 1
    const { data: updated1, error: update1Err } = await supabase
        .from('schedule_entries_staging')
        .update({
            facility_name_raw: parsed1.facility_name_raw,
            facility_id: parsed1.facility_id,
            facility_match_confidence: parsed1.facility_match_confidence,
            day_of_week: parsed1.day_of_week,
            start_time: parsed1.start_time,
            end_time: parsed1.end_time,
            validation_status: parsed1.validation_status,
            validation_errors: parsed1.validation_errors,
            validation_warnings: parsed1.validation_warnings,
            has_internal_conflict: false,
            has_external_conflict: false,
            conflict_entry_ids: [],
            conflict_schedule_ids: [],
        })
        .eq('id', entry_id)
        .select('*, facilities(name, room_number)')
        .single()

    if (update1Err || !updated1) {
        return NextResponse.json({ error: update1Err?.message || 'Failed to update session 1' }, { status: 500 })
    }

    // Insert new entry → session 2
    const { data: inserted2, error: insert2Err } = await supabase
        .from('schedule_entries_staging')
        .insert({
            schedule_upload_id: uploadId,
            entry_source: 'manual_entry',
            row_number: newRowNumber,
            course_code: original.course_code,
            course_name: original.course_name,
            section: original.section,
            instructor_id: original.instructor_id,
            instructor_name: original.instructor_name,
            facility_name_raw: parsed2.facility_name_raw,
            facility_id: parsed2.facility_id,
            facility_match_confidence: parsed2.facility_match_confidence,
            day_of_week: parsed2.day_of_week,
            start_time: parsed2.start_time,
            end_time: parsed2.end_time,
            effective_start_date: original.effective_start_date,
            effective_end_date: original.effective_end_date,
            session_type: original.session_type,
            validation_status: parsed2.validation_status,
            validation_errors: parsed2.validation_errors,
            validation_warnings: parsed2.validation_warnings,
            has_internal_conflict: false,
            has_external_conflict: false,
        })
        .select('*, facilities(name, room_number)')
        .single()

    if (insert2Err || !inserted2) {
        return NextResponse.json({ error: insert2Err?.message || 'Failed to insert session 2' }, { status: 500 })
    }

    // Re-run conflict detection for both
    const [conflicts1, conflicts2] = await Promise.all([
        detectConflicts(supabase, uploadId, entry_id,
            parsed1.facility_id, original.instructor_id, original.section || '',
            parsed1.day_of_week, parsed1.start_time, parsed1.end_time,
            parsed1.facility_name_raw, original.instructor_name),
        detectConflicts(supabase, uploadId, inserted2.id,
            parsed2.facility_id, original.instructor_id, original.section || '',
            parsed2.day_of_week, parsed2.start_time, parsed2.end_time,
            parsed2.facility_name_raw, original.instructor_name),
    ])

    // Re-read both to get updated conflict flags set by detectConflicts
    const [{ data: final1 }, { data: final2 }] = await Promise.all([
        supabase.from('schedule_entries_staging').select('*, facilities(name, room_number)').eq('id', entry_id).single(),
        supabase.from('schedule_entries_staging').select('*, facilities(name, room_number)').eq('id', inserted2.id).single(),
    ])

    await updateUploadCounts(supabase, uploadId)

    return NextResponse.json({
        session1: final1 ?? updated1,
        session2: final2 ?? inserted2,
        conflicts1,
        conflicts2,
    })
}
