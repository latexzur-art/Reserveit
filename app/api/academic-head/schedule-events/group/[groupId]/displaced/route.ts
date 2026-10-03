import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'

/**
 * GET /api/academic-head/schedule-events/group/[groupId]/displaced
 * Returns bookings and class schedules displaced by a school event group.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const { groupId } = await params
  const supabase = createAdminClient()

  try {
    // Get all booking IDs in this group
    const { data: groupRows, error: groupError } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, end_time, event_name')
      .eq('group_id', groupId)
      .eq('booking_type', 'school_event_block')

    if (groupError) throw groupError
    if (!groupRows?.length) {
      return NextResponse.json({ bookings: [], class_schedules: [] })
    }

    const groupBookingIds = groupRows.map(r => r.id)

    // Find displaced bookings
    const { data: displacedBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        original_date,
        original_start_time,
        original_end_time,
        current_status,
        reschedule_deadline,
        user_id,
        users!inner ( full_name ),
        booking_facilities ( facilities ( name, room_number ) )
      `)
      .in('block_event_id', groupBookingIds)
      .in('current_status', ['awaiting_reschedule', 'cancelled'])

    if (bookingsError) throw bookingsError

    // Find class schedule reschedule offers
    const { data: classOffers, error: offersError } = await supabase
      .from('class_schedule_reschedule_offers')
      .select(`
        id,
        affected_date,
        status,
        deadline,
        class_schedule_id,
        class_schedules!inner (
          course_code,
          course_name,
          section,
          instructor_name,
          start_time,
          end_time,
          facilities ( name )
        )
      `)
      .in('block_event_id', groupBookingIds)

    if (offersError) throw offersError

    const bookings = (displacedBookings ?? []).map((b: any) => ({
      id: b.id,
      booking_reference: b.booking_reference,
      user_name: b.users?.full_name ?? 'Unknown',
      original_date: b.original_date,
      original_start: b.original_start_time?.slice(0, 5),
      original_end: b.original_end_time?.slice(0, 5),
      facility_name: b.booking_facilities?.[0]?.facilities?.name ?? 'N/A',
      current_status: b.current_status,
      reschedule_deadline: b.reschedule_deadline,
    }))

    const class_schedules = (classOffers ?? []).map((o: any) => ({
      id: o.id,
      course_code: o.class_schedules?.course_code ?? o.class_schedules?.course_name ?? 'N/A',
      section: o.class_schedules?.section ?? '',
      instructor_name: o.class_schedules?.instructor_name ?? 'N/A',
      original_time: `${o.class_schedules?.start_time?.slice(0, 5)}–${o.class_schedules?.end_time?.slice(0, 5)}`,
      facility_name: o.class_schedules?.facilities?.name ?? 'N/A',
      affected_date: o.affected_date,
      reschedule_status: o.status,
      deadline: o.deadline,
    }))

    return NextResponse.json({ bookings, class_schedules })
  } catch (err: any) {
    console.error('[API] GET displaced items error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
