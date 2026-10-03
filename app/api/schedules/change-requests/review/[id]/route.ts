/**
 * POST  /api/schedules/change-requests/review/[id] — approve or reject a change request
 *        Body: { action: 'approve' | 'reject', notes?: string }
 * PATCH /api/schedules/change-requests/review/[id] — AH modifies proposed values before approving
 *        Body: { new_course_code?, new_course_name?, new_section?, new_instructor_name?,
 *                new_day_of_week?, new_start_time?, new_end_time?, new_facility_id? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { scheduleChangeApprovedEmail, scheduleChangeRejectedEmail } from '@/backend/notifications/emailTemplates'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const { id } = await params
  const body = await request.json()
  const { action, notes } = body

  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 }
    )
  }

  if (action === 'reject' && (!notes || notes.trim().length < 5)) {
    return NextResponse.json(
      { error: 'Rejection requires notes (min 5 chars)' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Fetch request details including requester's email and original schedule info
  const { data: changeReq } = await supabase
    .from('schedule_change_requests')
    .select(`
      requested_by,
      change_type,
      new_course_code,
      new_section,
      requester:users!requested_by(id, full_name, email),
      original:class_schedules!original_schedule_id(course_code, section)
    `)
    .eq('id', id)
    .single()

  if (!changeReq) {
    return NextResponse.json({ error: 'Change request not found' }, { status: 404 })
  }

  const requester = (changeReq as any).requester as { id: string; full_name: string; email: string } | null
  const original = (changeReq as any).original as { course_code: string; section: string } | null
  const courseCode = changeReq.new_course_code ?? original?.course_code ?? null
  const section = changeReq.new_section ?? original?.section ?? null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  if (action === 'approve') {
    const { data: result, error } = await supabase.rpc('approve_change_request', {
      p_request_id: id,
      p_reviewer_id: user.id,
      p_notes: notes ?? null,
    })

    if (error) {
      console.error('[POST review] approve:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // In-app notification to program head
    await sendNotification(supabase, {
      user_id: changeReq.requested_by,
      title: 'Schedule Change Approved',
      message: `Your ${changeReq.change_type} request has been approved${notes ? `: ${notes}` : ''}.`,
      type: 'success',
      source_type: 'schedule_change_request',
      source_id: id,
      action_url: `${appUrl}/program/change-requests`,
    })

    // Email the program head
    if (requester?.email) {
      try {
        const { subject, htmlBody } = scheduleChangeApprovedEmail({
          phName: requester.full_name,
          changeType: changeReq.change_type as 'modify' | 'cancel' | 'add',
          courseCode,
          section,
          reviewedByName: user.full_name,
          notes: notes ?? null,
          dashboardUrl: `${appUrl}/program/approved-schedules`,
        })
        await sendBrevoEmail({ to: requester.email, subject, htmlBody })
      } catch (emailErr) {
        console.error('[review] approve email error:', emailErr)
      }
    }

    return NextResponse.json({ success: true, result })
  } else {
    const { data: result, error } = await supabase.rpc('reject_change_request', {
      p_request_id: id,
      p_reviewer_id: user.id,
      p_notes: notes,
    })

    if (error) {
      console.error('[POST review] reject:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // In-app notification to program head
    await sendNotification(supabase, {
      user_id: changeReq.requested_by,
      title: 'Schedule Change Rejected',
      message: `Your ${changeReq.change_type} request was rejected. Reason: ${notes}`,
      type: 'error',
      source_type: 'schedule_change_request',
      source_id: id,
      action_url: `${appUrl}/program/change-requests`,
    })

    // Email the program head
    if (requester?.email) {
      try {
        const { subject, htmlBody } = scheduleChangeRejectedEmail({
          phName: requester.full_name,
          changeType: changeReq.change_type as 'modify' | 'cancel' | 'add',
          courseCode,
          section,
          reviewedByName: user.full_name,
          rejectionReason: notes,
          dashboardUrl: `${appUrl}/program/approved-schedules`,
        })
        await sendBrevoEmail({ to: requester.email, subject, htmlBody })
      } catch (emailErr) {
        console.error('[review] reject email error:', emailErr)
      }
    }

    return NextResponse.json({ success: true, result })
  }
}

/**
 * PATCH — Academic Head modifies the proposed values before approving.
 * Updates new_* fields on the change request row so approve_change_request RPC uses them.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const { id } = await params
  const body = await request.json()
  const supabase = createAdminClient()

  // Only allow updating new_* fields
  const allowedFields = [
    'new_facility_id', 'new_course_code', 'new_course_name', 'new_section',
    'new_instructor_name', 'new_day_of_week', 'new_start_time', 'new_end_time',
  ]
  const updates: Record<string, any> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from('schedule_change_requests')
    .update(updates)
    .eq('id', id)
    .eq('status', 'pending')

  if (error) {
    console.error('[PATCH review]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
