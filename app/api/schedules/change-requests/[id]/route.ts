/**
 * GET    /api/schedules/change-requests/[id] — get single change request
 * DELETE /api/schedules/change-requests/[id] — cancel own draft/pending request
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireProgramHead()
  if (authError) return authError

  const { id } = await params
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
      requester:users!requested_by(id, full_name, email),
      reviewer:users!reviewed_by(id, full_name)
    `)
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireProgramHead()
  if (authError) return authError

  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('schedule_change_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('requested_by', user.id)
    .in('status', ['draft', 'pending'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
