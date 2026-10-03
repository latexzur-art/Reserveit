/**
 * GET /api/schedules/live
 * Read-only: view active class schedules (used by hardConstraintChecker for CLASS_CONFLICT).
 * Supports filters: ?facility_id=&day_of_week=&academic_term_id=
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedInternal } from '@/lib/auth/guards'
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuthenticatedInternal()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const facilityId = searchParams.get('facility_id')
  const dayOfWeek = searchParams.get('day_of_week')
  const termId = searchParams.get('academic_term_id')
  const departmentId = searchParams.get('department_id')
  const unassigned = searchParams.get('unassigned') === 'true'
  const limit = Math.min(500, parseInt(searchParams.get('limit') ?? '100'))

  const supabase = createAdminClient()

  let query = supabase
    .from('class_schedules')
    .select(`
      id,
      course_code,
      course_name,
      section,
      session_type,
      instructor_id,
      instructor_name,
      day_of_week,
      start_time,
      end_time,
      effective_start_date,
      effective_end_date,
      facility_id,
      facilities(id, name, room_number),
      departments(id, name)
    `)
    .eq('is_active', true)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(limit)

  if (facilityId) query = query.eq('facility_id', facilityId)
  if (dayOfWeek) query = query.eq('day_of_week', parseInt(dayOfWeek))
  if (termId) query = query.eq('academic_term_id', termId)
  if (departmentId) query = query.eq('department_id', departmentId)
  if (unassigned) query = query.is('instructor_id', null)

  const { data: schedules, error } = await query

  if (error) {
    console.error('[GET /api/schedules/live] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ schedules: schedules ?? [] })
}
