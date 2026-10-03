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
            .eq('is_active', false)
            .is('superseded_by', null)
            .ilike('supersede_reason', 'Rolled back%')
            .order('superseded_at', { ascending: false })

        if (error) throw error

        return NextResponse.json({ rolledBack: data ?? [] })
    } catch (error: any) {
        console.error('Fetch rolled-back error:', error)
        return NextResponse.json({ error: error.message || 'Failed to fetch rolled-back schedules' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

    const supabase = createAdminClient()

    try {
        const body = await request.json()
        const { scheduleIds } = body

        if (!scheduleIds || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
            return NextResponse.json({ error: 'Schedule IDs are required' }, { status: 400 })
        }

        // Safety check: only allow deletion of rolled-back (soft-deleted) rows
        const { data: eligible, error: checkErr } = await supabase
            .from('class_schedules')
            .select('id')
            .in('id', scheduleIds)
            .eq('is_active', false)
            .is('superseded_by', null)
            .ilike('supersede_reason', 'Rolled back%')

        if (checkErr) throw checkErr

        if (!eligible || eligible.length === 0) {
            return NextResponse.json({ error: 'No eligible rolled-back schedules found' }, { status: 404 })
        }

        const eligibleIds = eligible.map(r => r.id)

        const { error: deleteErr } = await supabase
            .from('class_schedules')
            .delete()
            .in('id', eligibleIds)

        if (deleteErr) throw deleteErr

        return NextResponse.json({ success: true, count: eligibleIds.length })
    } catch (error: any) {
        console.error('Permanent delete rolled-back error:', error)
        return NextResponse.json({ error: error.message || 'Failed to permanently delete schedules' }, { status: 500 })
    }
}
