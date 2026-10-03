import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const supabase = createAdminClient()

        // 1. Additions (Active class_schedules, not superseded, version = 1)
        const { data: additions, error: addErr } = await supabase
            .from('class_schedules')
            .select(`
                id, course_code, course_name, section, instructor_name,
                day_of_week, start_time, end_time, version,
                is_active, created_at,
                facility_id,
                facilities(name, room_number),
                departments(id, code, name)
            `)
            .eq('is_active', true)
            .is('superseded_by', null)
            .eq('version', 1)
            .order('created_at', { ascending: false })
            .limit(100)

        if (addErr) throw addErr

        // 2. Modifications
        const { data: modifications, error: modErr } = await supabase
            .from('class_schedules')
            .select(`
                id, course_code, course_name, section, instructor_name,
                day_of_week, start_time, end_time, version,
                superseded_by, superseded_at, supersede_reason,
                is_active, created_at, updated_at,
                facility_id,
                facilities(name, room_number),
                departments(id, code, name)
            `)
            .not('superseded_by', 'is', null)
            .order('superseded_at', { ascending: false })
            .limit(100)

        if (modErr) throw modErr

        const modWithNewVersions = await Promise.all(
            (modifications ?? []).map(async (mod: any) => {
                const { data: newVersion } = await supabase
                    .from('class_schedules')
                    .select(`
                        id, course_code, course_name, section, instructor_name,
                        day_of_week, start_time, end_time, version,
                        is_active, created_at,
                        facility_id,
                        facilities(name, room_number),
                        departments(id, code, name)
                    `)
                    .eq('id', mod.superseded_by)
                    .single()

                return {
                    original: mod,
                    modified: newVersion,
                }
            })
        )

        // 3. Deletions
        const { data: deletions, error: delErr } = await supabase
            .from('class_schedules')
            .select(`
                id, course_code, course_name, section, instructor_name,
                day_of_week, start_time, end_time, version,
                superseded_at, supersede_reason,
                is_active, created_at,
                facility_id,
                facilities(name, room_number),
                departments(id, code, name)
            `)
            .eq('is_active', false)
            .is('superseded_by', null)
            .order('superseded_at', { ascending: false })
            .limit(100)

        if (delErr) throw delErr

        // 4. Change Requests
        const { data: changeRequests, error: crErr } = await supabase
            .from('schedule_change_requests')
            .select(`
                id, change_type, status, reason, created_at,
                reviewed_at, review_notes,
                original_schedule_id,
                class_schedules!original_schedule_id (
                    course_code, section, day_of_week, start_time, end_time, instructor_name, facilities(name)
                ),
                users!requested_by (full_name, email),
                departments(code, name)
            `)
            .order('created_at', { ascending: false })
            .limit(100)
            
        if (crErr) throw crErr

        return NextResponse.json({
            additions: additions ?? [],
            modifications: modWithNewVersions,
            deletions: deletions ?? [],
            changeRequests: changeRequests ?? [],
        })
    } catch (error: any) {
        console.error('Error fetching activity logs:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
