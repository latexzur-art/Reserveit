/**
 * POST /api/schedules/history/drafts/publish
 * Publish draft staging entries directly into class_schedules.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
export async function POST(request: NextRequest) {
    const { error: authError, user } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

    const supabase = createAdminClient()

    try {
        const body = await request.json()
        const { stagingIds } = body

        if (!stagingIds || !Array.isArray(stagingIds) || stagingIds.length === 0) {
            return NextResponse.json({ error: 'Staging IDs are required' }, { status: 400 })
        }

        // 1. Fetch the entries being published
        const { data: entries, error: fetchErr } = await supabase
            .from('schedule_entries_staging')
            .select(`
                *, 
                schedule_uploads(academic_term_id, department_id, batch_effective_date, batch_effective_end_date)
            `)
            .in('id', stagingIds)

        if (fetchErr) throw fetchErr

        if (!entries || entries.length === 0) {
            return NextResponse.json({ error: 'No valid staging entries found' }, { status: 404 })
        }

        // Prevent publishing if any validation errors still exist
        const hasErrors = entries.some(e => e.validation_status === 'error')
        if (hasErrors) {
            return NextResponse.json({ error: 'Some drafts still have unresolved validation errors. Edit them first.' }, { status: 400 })
        }

        let publishedCount = 0
        const errors: string[] = []

        // 2. Loop & Insert classes
        for (const entry of entries) {
            const upload = Array.isArray(entry.schedule_uploads) ? entry.schedule_uploads[0] : entry.schedule_uploads

            if (!upload || !entry.facility_id) {
                errors.push(`${entry.course_code}: Upload metadata or facility missing`)
                continue
            }

            const { data: newSchedule, error: insertErr } = await supabase
                .from('class_schedules')
                .insert({
                    schedule_upload_id: entry.schedule_upload_id,
                    staging_entry_id: entry.id,
                    academic_term_id: upload.academic_term_id,
                    department_id: upload.department_id,
                    facility_id: entry.facility_id,
                    course_code: entry.course_code,
                    course_name: entry.course_name,
                    session_type: entry.session_type,
                    section: entry.section,
                    instructor_id: entry.instructor_id,
                    instructor_name: entry.instructor_name,
                    day_of_week: entry.day_of_week,
                    start_time: entry.start_time,
                    end_time: entry.end_time,
                    effective_start_date: entry.effective_start_date ?? upload.batch_effective_date ?? new Date().toISOString().split('T')[0],
                    effective_end_date: entry.effective_end_date ?? upload.batch_effective_end_date,
                    is_active: true,
                    version: 1,
                })

            if (insertErr) {
                // If unique constraint overlap
                if (insertErr.message.includes('overlap')) {
                    errors.push(`${entry.course_code}: Schedule overlapping with another live class`)
                } else {
                    errors.push(`${entry.course_code}: ${insertErr.message}`)
                }

                // Note back in staging
                await supabase
                    .from('schedule_entries_staging')
                    .update({
                        academic_head_review_status: 'academic_head_flagged',
                        academic_head_review_notes: 'Publish overlap error',
                        has_external_conflict: true
                    })
                    .eq('id', entry.id)

                continue
            }

            // Success
            publishedCount++
            await supabase
                .from('schedule_entries_staging')
                .update({
                    is_published: true,
                    academic_head_review_status: 'academic_head_approved',
                    academic_head_review_notes: 'Re-published from Drafts'
                })
                .eq('id', entry.id)
        }

        return NextResponse.json({
            success: true,
            count: publishedCount,
            errors
        })
    } catch (error: any) {
        console.error('Draft Publish error:', error)
        return NextResponse.json({ error: error.message || 'Failed to publish drafts' }, { status: 500 })
    }
}
