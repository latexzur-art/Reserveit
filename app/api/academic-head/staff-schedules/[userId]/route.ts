import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const hasRole = user.roles?.some((r: { name: string }) =>
    ['academic_head', 'building_admin', 'admin', 'it_administrator'].includes(r.name.toLowerCase())
  )
  if (!hasRole) {
    return NextResponse.json({ error: 'Forbidden: academic_head or admin role required' }, { status: 403 })
  }

  const { userId } = await params
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: classes, error: dbError } = await supabase
    .from('class_schedules')
    .select(`
      id,
      course_code,
      course_name,
      section,
      instructor_name,
      instructor_id,
      day_of_week,
      start_time,
      end_time,
      effective_start_date,
      effective_end_date,
      department_id,
      facility_id,
      facilities(id, name, room_number, floors(floor_number, buildings(name))),
      departments(id, name, code)
    `)
    .eq('instructor_id', userId)
    .eq('is_active', true)
    .is('superseded_by', null)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (dbError) {
    console.error('[GET /api/academic-head/staff-schedules] Error:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  const schedules = classes ?? []
  const uniqueCourses = new Set(schedules.map(c => c.course_code))
  const departmentSet = new Map<string, { id: string; name: string; code: string }>()
  for (const c of schedules) {
    const dept = c.departments as any
    if (dept?.id && !departmentSet.has(dept.id)) {
      departmentSet.set(dept.id, { id: dept.id, name: dept.name, code: dept.code })
    }
  }

  return NextResponse.json({
    classes: schedules.map(c => {
      const facility = c.facilities as any
      const dept = c.departments as any
      return {
        id: c.id,
        course_code: c.course_code,
        course_name: c.course_name,
        section: c.section,
        instructor_name: c.instructor_name,
        day_of_week: c.day_of_week,
        start_time: c.start_time,
        end_time: c.end_time,
        effective_start_date: c.effective_start_date,
        effective_end_date: c.effective_end_date,
        facility: {
          id: facility?.id ?? c.facility_id,
          name: facility?.name ?? 'Unknown',
          room_number: facility?.room_number ?? '',
          building: facility?.floors?.buildings?.name ?? '',
        },
        department: {
          id: dept?.id ?? c.department_id,
          name: dept?.name ?? 'Unknown',
          code: dept?.code ?? '',
        },
      }
    }),
    meta: {
      total_classes: schedules.length,
      unique_courses: uniqueCourses.size,
      departments: Array.from(departmentSet.values()),
    },
  })
}
