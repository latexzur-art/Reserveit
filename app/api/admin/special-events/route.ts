import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
/**
 * GET /api/admin/special-events
 * Returns the pending-review queue of special event requests from Program Heads.
 * Accessible by academic_head and building_admin.
 */
export async function GET(request: Request) {
  const { error } = await requireAcademicHeadOrBuildingAdmin()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'pending'

  const supabase = createAdminClient()

  const { data: events, error: dbError } = await supabase
    .from('bookings')
    .select(`
      id, event_name, booking_date, start_time, end_time, current_status,
      event_approval_status, event_requested_by_role, event_decision_notes,
      event_decided_at, created_at,
      users!bookings_user_id_fkey ( id, full_name, email ),
      event_decided_by_user:event_decided_by ( id, full_name, email ),
      booking_facilities (
        facility_id,
        facilities ( id, name, room_number )
      )
    `)
    .eq('booking_type', 'school_event_block')
    .eq('event_requires_approval', true)
    .eq('event_approval_status', status)
    .order('created_at', { ascending: false })

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ events: events ?? [] })
}
