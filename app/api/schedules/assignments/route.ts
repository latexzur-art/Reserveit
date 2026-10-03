/**
 * GET  /api/schedules/assignments — list assignment lineups for the current
 *      user's department (academic_head/building_admin may cross-department).
 * POST /api/schedules/assignments — create a lineup of {class_schedule_id,
 *      proposed_instructor_id, proposed_instructor_name} items, then:
 *        program_head  -> submit (pending) + notify academic heads
 *        academic_head -> approve immediately (self-assign, no wait)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
import { notifyAssignmentRequest, notifyAssignedProfessors } from '@/backend/schedule/assignmentNotifications'

export async function GET(request: NextRequest) {
  const { error: authError, user } = await requireProgramHead()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const roleNames = (user.roles ?? []).map((r: { name: string }) => r.name)
  const canCrossDept = roleNames.includes('academic_head') || roleNames.includes('building_admin')
  const departmentId = (canCrossDept ? searchParams.get('department_id') : null) ?? user.department?.id ?? null

  const supabase = createAdminClient()
  let query = supabase
    .from('professor_assignment_lineups')
    .select(`
      *,
      creator:users!created_by(id, full_name, email),
      reviewer:users!reviewed_by(id, full_name),
      departments(id, name),
      items:professor_assignment_items(
        id, class_schedule_id, proposed_instructor_id, proposed_instructor_name,
        status, conflict_details, resulting_schedule_id,
        schedule:class_schedules!class_schedule_id(
          id, course_code, course_name, section, session_type,
          day_of_week, start_time, end_time, instructor_name,
          facilities(name, room_number)
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (departmentId) query = query.eq('department_id', departmentId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('[GET /api/schedules/assignments]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ lineups: data ?? [] })
}

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireProgramHead()
  if (authError) return authError

  const body = await request.json()
  const items: Array<{
    class_schedule_id: string
    proposed_instructor_id: string | null
    proposed_instructor_name: string
  }> = body.items ?? []

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items required' }, { status: 400 })
  }
  if (items.some((i) => !i.class_schedule_id || !i.proposed_instructor_name)) {
    return NextResponse.json(
      { error: 'each item needs class_schedule_id and proposed_instructor_name' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const roleNames = (user.roles ?? []).map((r: { name: string }) => r.name)
  const isAcademicHead = roleNames.includes('academic_head') || roleNames.includes('building_admin')

  // Pin department from the first target section (enforced server-side; admin
  // client bypasses RLS so we set department_id explicitly).
  const { data: firstSchedule } = await supabase
    .from('class_schedules')
    .select('department_id, academic_term_id')
    .eq('id', items[0].class_schedule_id)
    .single()

  const departmentId = firstSchedule?.department_id ?? user.department?.id ?? null
  if (!departmentId) {
    return NextResponse.json({ error: 'Could not resolve department' }, { status: 400 })
  }

  const { data: lineup, error: lineupErr } = await supabase
    .from('professor_assignment_lineups')
    .insert({
      department_id: departmentId,
      academic_term_id: firstSchedule?.academic_term_id ?? null,
      created_by: user.id,
      status: 'draft',
    })
    .select('id')
    .single()

  if (lineupErr || !lineup) {
    console.error('[POST /api/schedules/assignments] lineup:', lineupErr?.message)
    return NextResponse.json({ error: lineupErr?.message ?? 'Create failed' }, { status: 500 })
  }

  const { error: itemsErr } = await supabase
    .from('professor_assignment_items')
    .insert(items.map((i) => ({
      lineup_id: lineup.id,
      class_schedule_id: i.class_schedule_id,
      proposed_instructor_id: i.proposed_instructor_id ?? null,
      proposed_instructor_name: i.proposed_instructor_name,
    })))

  if (itemsErr) {
    console.error('[POST /api/schedules/assignments] items:', itemsErr.message)
    await supabase.from('professor_assignment_lineups').delete().eq('id', lineup.id)
    return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  // Academic head self-assigns directly; program head submits for AH approval.
  if (isAcademicHead) {
    const { data: result, error } = await supabase.rpc('approve_assignment_lineup', {
      p_lineup_id: lineup.id, p_reviewer_id: user.id, p_notes: 'Self-assigned',
    })
    if (error) {
      console.error('[POST /api/schedules/assignments] self-approve:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    // Notify each assigned professor (in-app + email).
    await notifyAssignedProfessors(supabase, lineup.id)
    return NextResponse.json({ id: lineup.id, status: 'approved', result }, { status: 201 })
  }

  const { error: submitErr } = await supabase.rpc('submit_assignment_lineup', { p_lineup_id: lineup.id })
  if (submitErr) {
    console.error('[POST /api/schedules/assignments] submit:', submitErr.message)
    return NextResponse.json({ error: submitErr.message }, { status: 500 })
  }

  // Notify academic heads a lineup awaits review (in-app + email).
  await notifyAssignmentRequest(supabase, lineup.id, user.full_name, items.length)

  return NextResponse.json({ id: lineup.id, status: 'pending' }, { status: 201 })
}
