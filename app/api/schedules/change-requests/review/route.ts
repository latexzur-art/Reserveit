/**
 * GET /api/schedules/change-requests/review — list pending change requests for academic head
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
export async function GET(_request: NextRequest) {
  const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('schedule_change_requests')
    .select(`
      *,
      original:class_schedules!original_schedule_id(
        id, course_code, course_name, section, instructor_name,
        day_of_week, start_time, end_time, facility_id,
        facilities(name, room_number)
      ),
      new_facility:facilities!new_facility_id(id, name, room_number),
      requester:users!requested_by(id, full_name, email),
      departments(id, name)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[GET /api/schedules/change-requests/review]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ change_requests: data ?? [] })
}
