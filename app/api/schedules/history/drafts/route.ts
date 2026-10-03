import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
export async function GET(request: NextRequest) {
    const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

    const supabase = createAdminClient()

    try {
        const { data, error } = await supabase
            .from('schedule_entries_staging')
            .select(`
                id, course_code, course_name, section, instructor_name,
                day_of_week, start_time, end_time, validation_status,
                academic_head_review_status, academic_head_review_notes,
                has_internal_conflict, has_external_conflict,
                facilities(name, room_number),
                schedule_uploads!inner(
                    upload_status,
                    departments(id, code, name)
                )
            `)
            .eq('is_published', false)
            .in('schedule_uploads.upload_status', ['submitted', 'revision_requested'])
            .order('created_at', { ascending: false })

        if (error) throw error

        // Flatten departments from the nested schedule_uploads join to match DraftRecord shape
        const drafts = (data ?? []).map(({ schedule_uploads, ...entry }: any) => ({
            ...entry,
            departments: (schedule_uploads as any)?.departments ?? null,
        }))

        return NextResponse.json({ drafts })
    } catch (error: any) {
        console.error('Fetch drafts error:', error)
        return NextResponse.json({ error: error.message || 'Failed to fetch draft schedules' }, { status: 500 })
    }
}
