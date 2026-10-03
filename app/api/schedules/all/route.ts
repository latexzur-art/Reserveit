import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'

export const dynamic = 'force-dynamic'

/**
 * GET /api/schedules/all
 * List class schedules with filters: department_id, academic_term_id, search, include_inactive
 * Supports pagination via page + limit query params.
 */
export async function GET(request: NextRequest) {
  const { user } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const departmentId = searchParams.get('department_id')
  const termId = searchParams.get('academic_term_id')
  const section = searchParams.get('section')?.trim()
  const search = searchParams.get('search')?.trim()
  const includeInactive = searchParams.get('include_inactive') === 'true'
  const unassigned = searchParams.get('unassigned') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  let query = supabase
    .from('class_schedules')
    .select(
      `id, course_code, course_name, section, instructor_name,
       day_of_week, start_time, end_time,
       effective_start_date, effective_end_date,
       is_active, version, created_at,
       facility_id, department_id, academic_term_id,
       facilities(id, name, room_number),
       departments(id, name, code),
       academic_terms(id, term_name, term_code, academic_year, term_type)`,
      { count: 'exact' }
    )
    .order('course_code', { ascending: true })
    .range(offset, offset + limit - 1)

  if (!includeInactive) query = query.eq('is_active', true)
  if (unassigned) query = query.is('instructor_id', null)
  if (departmentId) query = query.eq('department_id', departmentId)
  if (termId) query = query.eq('academic_term_id', termId)
  if (section) query = query.eq('section', section)
  if (search) {
    query = query.or(
      `course_code.ilike.%${search}%,course_name.ilike.%${search}%,section.ilike.%${search}%,instructor_name.ilike.%${search}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[GET /api/schedules/all]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ schedules: data ?? [], total: count ?? 0, page, limit })
}

/**
 * POST /api/schedules/all
 * Create a new class schedule entry directly (academic head only).
 */
export async function POST(request: NextRequest) {
  const { user } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const body = await request.json()

  const {
    academic_term_id,
    department_id,
    facility_id,
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
  } = body

  if (!academic_term_id || !department_id || !course_code || !course_name || !section || day_of_week == null || !start_time || !end_time) {
    return NextResponse.json({ error: 'Missing required fields: academic_term_id, department_id, course_code, course_name, section, day_of_week, start_time, end_time' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('class_schedules')
    .insert({
      academic_term_id,
      department_id,
      facility_id: facility_id || null,
      course_code,
      course_name,
      section,
      instructor_name: instructor_name || null,
      instructor_id: instructor_id || null,
      day_of_week,
      start_time,
      end_time,
      effective_start_date: effective_start_date || null,
      effective_end_date: effective_end_date || null,
      is_active: true,
      version: 1,
    })
    .select(
      `id, course_code, course_name, section, instructor_name,
       day_of_week, start_time, end_time, effective_start_date, effective_end_date,
       is_active, version, facility_id, department_id, academic_term_id,
       facilities(id, name, room_number),
       departments(id, name, code),
       academic_terms(id, term_name, term_code, academic_year, term_type)`
    )
    .single()

  if (error) {
    console.error('[POST /api/schedules/all]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ schedule: data }, { status: 201 })
}
