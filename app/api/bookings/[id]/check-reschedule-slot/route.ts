import { NextRequest, NextResponse } from 'next/server'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { checkBookingConflict } from '@/lib/bookings/check-conflict'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const { id: __rawId } = await params
  const __idParsed = parseUuidParam(__rawId, 'booking id')
  if (!__idParsed.ok) return __idParsed.response
  const bookingId = __idParsed.value
  const { searchParams } = request.nextUrl
  const date = searchParams.get('date')
  const startTime = searchParams.get('start_time')
  const endTime = searchParams.get('end_time')

  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: 'date, start_time, end_time are required' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    // Verify booking belongs to this user
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, user_id, booking_facilities(facility_id)')
      .eq('id', bookingId)
      .eq('user_id', user!.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const facilityRow = Array.isArray(booking.booking_facilities)
      ? booking.booking_facilities[0]
      : booking.booking_facilities
    const facilityId = facilityRow?.facility_id

    if (!facilityId) {
      return NextResponse.json({ conflict: false })
    }

    const result = await checkBookingConflict(supabase, {
      facility_id: facilityId,
      booking_date: date,
      start_time: startTime,
      end_time: endTime,
      exclude_booking_id: bookingId,
    })

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
