import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
export async function GET(request: NextRequest) {
    const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

    const supabase = createAdminClient()

    try {
        const { data, error } = await supabase
            .from('class_schedules')
            .select(`
                id, course_code, course_name, section, instructor_name,
                day_of_week, start_time, end_time, version,
                is_active, created_at, updated_at,
                facility_id, schedule_upload_id,
                superseded_by, superseded_at, supersede_reason,
                facilities(name, room_number),
                departments(id, code, name)
            `)
            .eq('is_active', true)
            .is('superseded_by', null)
            .order('course_code')
            .order('day_of_week')

        if (error) throw error

        return NextResponse.json({ schedules: data ?? [] })
    } catch (error: any) {
        console.error('Fetch published schedules error:', error)
        return NextResponse.json({ error: error.message || 'Failed to fetch published schedules' }, { status: 500 })
    }
}
