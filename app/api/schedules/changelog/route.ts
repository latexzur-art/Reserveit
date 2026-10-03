import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/schedules/changelog
 * Fetch modifications (superseded schedules) and deletions (inactive schedules)
 */
export async function GET() {
    try {
        const supabase = createAdminClient()

        // Modifications: schedules that have been superseded (have a newer version)
        const { data: modifications, error: modErr } = await supabase
            .from('class_schedules')
            .select(`
        id, course_code, course_name, section, instructor_name,
        day_of_week, start_time, end_time, version,
        superseded_by, superseded_at, supersede_reason,
        is_active, created_at, updated_at,
        facility_id,
        facilities(name, room_number),
        departments(id, code, name),
        schedule_upload_id
      `)
            .not('superseded_by', 'is', null)
            .order('superseded_at', { ascending: false })
            .limit(100)

        if (modErr) throw modErr

        // For each modification, also fetch the new version
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

        // Deletions: schedules that are inactive and NOT superseded (just deleted)
        const { data: deletions, error: delErr } = await supabase
            .from('class_schedules')
            .select(`
        id, course_code, course_name, section, instructor_name,
        day_of_week, start_time, end_time, version,
        superseded_at, supersede_reason,
        is_active, created_at,
        facility_id,
        facilities(name, room_number),
        departments(id, code, name),
        schedule_upload_id
      `)
            .eq('is_active', false)
            .is('superseded_by', null)
            .order('superseded_at', { ascending: false })
            .limit(100)

        if (delErr) throw delErr

        return NextResponse.json({
            modifications: modWithNewVersions,
            deletions: deletions ?? [],
        })
    } catch (error: any) {
        console.error('Error fetching changelog:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
