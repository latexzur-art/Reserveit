import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
function computeDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

function mapBooking(b: any) {
  const bookingFacility = b.booking_facilities?.[0]?.facility
  const facility = Array.isArray(bookingFacility) ? bookingFacility[0] : bookingFacility
  const floor = Array.isArray(facility?.floors) ? facility.floors[0] : facility?.floors
  const building = Array.isArray(floor?.buildings) ? floor.buildings[0] : floor?.buildings

  const startTime = b.start_time?.slice(0, 5) ?? ''
  const endTime = b.end_time?.slice(0, 5) ?? ''

  return {
    id: b.id,
    referenceNumber: b.booking_reference,
    bookingDate: b.booking_date,
    startTime,
    endTime,
    durationMinutes: startTime && endTime ? computeDurationMinutes(startTime, endTime) : null,
    status: b.current_status,
    bookingPurpose: b.booking_purpose,
    purpose: b.purpose,
    eventName: b.event_name ?? null,
    expectedAttendees: b.expected_attendees ?? null,
    facilityId: facility?.id ?? null,
    facilityName: facility?.name ?? 'Unknown Facility',
    roomNumber: facility?.room_number ?? null,
    floorNumber: floor?.floor_number ?? null,
    buildingName: building?.name ?? null,
  }
}

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
  const today = new Date().toISOString().slice(0, 10)

  const { data: bookings, error: dbError } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_reference,
      booking_date,
      start_time,
      end_time,
      current_status,
      booking_purpose,
      purpose,
      event_name,
      expected_attendees,
      booking_facilities!inner(
        facility:facilities!inner(id, name, room_number,
          floors(floor_number, buildings(name)))
      )
    `)
    .eq('user_id', userId)
    .gte('booking_date', today)
    .in('current_status', ['pending', 'approved', 'auto_approved'])
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(50)

  if (dbError) {
    console.error('[GET /api/academic-head/staff-bookings] Error:', dbError.message)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({
    bookings: (bookings ?? []).map(mapBooking),
    meta: { total: bookings?.length ?? 0 },
  })
}
