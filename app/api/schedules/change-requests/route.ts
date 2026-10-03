/**
 * GET  /api/schedules/change-requests  — list change requests for current user's department
 * POST /api/schedules/change-requests  — create + immediately submit a change request
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { scheduleChangeRequestSubmittedEmail } from '@/backend/notifications/emailTemplates'

export async function GET(request: NextRequest) {
  const { error: authError, user } = await requireProgramHead()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') // optional filter
  // Only academic_head/building_admin may inspect other departments. A plain
  // program_head is pinned to their own department — the query param is ignored.
  const roleNames = (user.roles ?? []).map((r: { name: string }) => r.name)
  const canCrossDept = roleNames.includes('academic_head') || roleNames.includes('building_admin')
  const departmentId = (canCrossDept ? searchParams.get('department_id') : null) ?? user.department?.id ?? null

  const supabase = createAdminClient()

  let query = supabase
    .from('schedule_change_requests')
    .select(`
      *,
      original:class_schedules!original_schedule_id(
        id, course_code, course_name, section, instructor_name,
        day_of_week, start_time, end_time, facility_id,
        facilities(name, room_number)
      ),
      requester:users!requested_by(id, full_name, email),
      reviewer:users!reviewed_by(id, full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (departmentId) {
    query = query.eq('department_id', departmentId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/schedules/change-requests]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ change_requests: data ?? [] })
}

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireProgramHead()
  if (authError) return authError

  const body = await request.json()
  const supabase = createAdminClient()

  const {
    original_schedule_id,
    change_type,
    reason,
    new_facility_id,
    new_course_code,
    new_course_name,
    new_section,
    new_instructor_name,
    new_day_of_week,
    new_start_time,
    new_end_time,
  } = body

  if (!change_type || !reason) {
    return NextResponse.json(
      { error: 'change_type and reason are required' },
      { status: 400 }
    )
  }

  if (change_type !== 'add' && !original_schedule_id) {
    return NextResponse.json(
      { error: 'original_schedule_id required for modify/cancel' },
      { status: 400 }
    )
  }

  // Create via RPC
  const { data: requestId, error: createErr } = await supabase.rpc(
    'create_schedule_change_request',
    {
      p_original_schedule_id: original_schedule_id ?? null,
      p_change_type: change_type,
      p_requested_by: user.id,
      p_reason: reason,
      p_new_facility_id: new_facility_id ?? null,
      p_new_course_code: new_course_code ?? null,
      p_new_course_name: new_course_name ?? null,
      p_new_section: new_section ?? null,
      p_new_instructor_name: new_instructor_name ?? null,
      p_new_day_of_week: new_day_of_week ?? null,
      p_new_start_time: new_start_time ?? null,
      p_new_end_time: new_end_time ?? null,
    }
  )

  if (createErr) {
    console.error('[POST /api/schedules/change-requests] create:', createErr.message)
    return NextResponse.json({ error: createErr.message }, { status: 500 })
  }

  // Immediately submit for review
  const { data: submitted, error: submitErr } = await supabase.rpc(
    'submit_change_request',
    { p_request_id: requestId }
  )

  if (submitErr) {
    console.error('[POST /api/schedules/change-requests] submit:', submitErr.message)
    return NextResponse.json({ error: submitErr.message }, { status: 500 })
  }

  // Notify academic heads (in-app)
  await sendNotificationToRoles(supabase, ['academic_head'], {
    title: 'New Schedule Change Request',
    message: `${user.full_name} has submitted a ${change_type} request${change_type !== 'add' ? ' for an existing schedule' : ' for a new schedule'}. Please review.`,
    type: 'info',
    source_type: 'schedule_change_request',
    source_id: requestId,
    action_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/academic/schedules/change-requests`,
  })

  // Email all academic heads
  try {
    const { data: ahUsers } = await supabase
      .from('user_roles')
      .select('users!inner(id, full_name, email)')
      .eq('roles.name', 'academic_head')
      .eq('users.account_status', 'active')

    // Also do a direct query in case the join alias doesn't work as expected
    const { data: ahUsersAlt } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('account_status', 'active')
      .in('id',
        (await supabase
          .from('user_roles')
          .select('user_id, roles!inner(name)')
          .eq('roles.name', 'academic_head')
        ).data?.map((r: any) => r.user_id) ?? []
      )

    const recipients: { full_name: string; email: string }[] = ahUsersAlt ?? []

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const reviewUrl = `${appUrl}/academic-head/schedule-changes`

    await Promise.allSettled(
      recipients
        .filter((u) => u.email)
        .map((ah) => {
          const { subject, htmlBody } = scheduleChangeRequestSubmittedEmail({
            ahName: ah.full_name,
            phName: user.full_name,
            changeType: change_type as 'modify' | 'cancel' | 'add',
            courseCode: new_course_code ?? null,
            section: new_section ?? null,
            reason,
            reviewUrl,
          })
          return sendBrevoEmail({ to: ah.email, subject, htmlBody })
        })
    )
  } catch (emailErr) {
    console.error('[change-requests POST] AH email error:', emailErr)
    // Non-fatal — in-app notification already sent
  }

  return NextResponse.json({ id: requestId, status: 'pending' }, { status: 201 })
}
