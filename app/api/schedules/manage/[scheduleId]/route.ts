import { NextResponse } from 'next/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * PATCH /api/schedules/manage/[scheduleId]
 * Edit an individual schedule — creates a new version and supersedes the old one
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ scheduleId: string }> }
) {
    const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError
    try {
        const supabase = createAdminClient()
        const { scheduleId } = await params
        const body = await request.json()

        // Fetch the original schedule
        const { data: original, error: fetchErr } = await supabase
            .from('class_schedules')
            .select('*')
            .eq('id', scheduleId)
            .single()

        if (fetchErr) throw fetchErr
        if (!original) throw new Error('Schedule not found')

        // Create a new version with the updated fields
        const { data: newSchedule, error: insertErr } = await supabase
            .from('class_schedules')
            .insert({
                schedule_upload_id: original.schedule_upload_id,
                staging_entry_id: original.staging_entry_id,
                academic_term_id: original.academic_term_id,
                department_id: original.department_id,
                facility_id: body.facility_id ?? original.facility_id,
                course_code: body.course_code ?? original.course_code,
                course_name: body.course_name ?? original.course_name,
                section: body.section ?? original.section,
                instructor_id: body.instructor_id ?? original.instructor_id,
                instructor_name: body.instructor_name ?? original.instructor_name,
                day_of_week: body.day_of_week ?? original.day_of_week,
                start_time: body.start_time ?? original.start_time,
                end_time: body.end_time ?? original.end_time,
                effective_start_date: body.effective_start_date ?? original.effective_start_date,
                effective_end_date: body.effective_end_date ?? original.effective_end_date,
                is_active: true,
                version: (original.version ?? 1) + 1,
            })
            .select()
            .single()

        if (insertErr) throw insertErr

        // Supersede the original
        const { error: updateErr } = await supabase
            .from('class_schedules')
            .update({
                is_active: false,
                superseded_by: newSchedule.id,
                superseded_at: new Date().toISOString(),
                supersede_reason: body.reason ?? 'Modified by Academic Head',
            })
            .eq('id', scheduleId)

        if (updateErr) throw updateErr

        return NextResponse.json({ schedule: newSchedule })
    } catch (error: any) {
        console.error('Error editing schedule:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

/**
 * DELETE /api/schedules/manage/[scheduleId]
 * Soft-delete: set is_active = false
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ scheduleId: string }> }
) {
    const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError
    try {
        const supabase = createAdminClient()
        const { scheduleId } = await params

        const { error } = await supabase
            .from('class_schedules')
            .update({
                is_active: false,
                superseded_at: new Date().toISOString(),
                supersede_reason: 'Deleted by Academic Head',
            })
            .eq('id', scheduleId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting schedule:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
