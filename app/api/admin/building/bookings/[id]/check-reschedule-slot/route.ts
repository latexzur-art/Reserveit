import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { checkBookingConflict } from '@/lib/bookings/check-conflict'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { id: bookingId } = await params
  const { searchParams } = request.nextUrl
  const date = searchParams.get('date')
  const startTime = searchParams.get('start_time')
  const endTime = searchParams.get('end_time')
  const facilityIdOverride = searchParams.get('facility_id')

  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: 'date, start_time, end_time are required' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    let facilityId: string | undefined = facilityIdOverride ?? undefined

    if (!facilityId) {
      // Fall back to the booking's current facility
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, booking_facilities(facility_id)')
        .eq('id', bookingId)
        .single()

      if (bookingError || !booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }

      const facilityRow = Array.isArray(booking.booking_facilities)
        ? booking.booking_facilities[0]
        : booking.booking_facilities
      facilityId = facilityRow?.facility_id
    }

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
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
