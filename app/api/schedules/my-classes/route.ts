/**
 * GET /api/schedules/my-classes
 * Returns class schedules assigned to the current authenticated instructor.
 * Matches by instructor_id (primary) and instructor_name (fallback).
 * Supports optional filters: department_id, course_code, section, day_of_week
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'

export async function GET(request: NextRequest) {
  const { user: profile, error: authError } = await getAuthUserWithRoles()
  if (!profile) {
    return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const departmentId = searchParams.get('department_id')
  const courseCode = searchParams.get('course_code')
  const section = searchParams.get('section')
  const dayOfWeek = searchParams.get('day_of_week')
  const scope = searchParams.get('scope')

  const PRIVILEGED_ROLES = new Set(['academic_head', 'admin', 'it_administrator', 'building_admin'])
  const isPrivileged = (profile.roles ?? []).some(r => PRIVILEGED_ROLES.has(r.name))
  const wantAll = scope === 'all' && isPrivileged

  const supabase = createAdminClient()

  // Build query for classes
  let query = supabase
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
    .eq('is_active', true)
    .is('superseded_by', null)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (!wantAll) {
    // Default: match by instructor_id OR instructor_name (case-insensitive)
    query = query.or(
      `instructor_id.eq.${profile.id},instructor_name.ilike.${profile.full_name}`
    )
  }

  // Apply optional filters
  if (departmentId) query = query.eq('department_id', departmentId)
  if (courseCode) query = query.eq('course_code', courseCode)
  if (section) query = query.eq('section', section)
  if (dayOfWeek) query = query.eq('day_of_week', parseInt(dayOfWeek))

  const { data: classes, error } = await query

  if (error) {
    console.error('[GET /api/schedules/my-classes] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const schedules = classes ?? []

  // Compute meta info
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
