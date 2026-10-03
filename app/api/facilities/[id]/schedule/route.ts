import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuthenticatedUser()
  if (error) return error

  const { id: facilityId } = await params
  if (!facilityId) return NextResponse.json({ error: 'Facility ID is required' }, { status: 400 })

  try {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    // 1. School event blocks
    const { data: schoolEvents, error: eventsError } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        booking_facilities!inner(facility_id)
      `)
      .eq('booking_facilities.facility_id', facilityId)
      .in('current_status', ['approved', 'auto_approved'])
      .or('booking_type.eq.school_event_block,booking_purpose.eq.school_event')
      .gte('booking_date', today)

    // 2. Regular bookings by any user (pending / approved / auto_approved / flagged)
    const { data: regularBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        booking_facilities!inner(facility_id)
      `)
      .eq('booking_facilities.facility_id', facilityId)
      .in('current_status', ['pending', 'approved', 'auto_approved', 'flagged'])
      .not('booking_type', 'eq', 'school_event_block')
      .not('booking_purpose', 'eq', 'school_event')
      .gte('booking_date', today)

    // 3. Administrative event holds
    const { data: blocks, error: blocksError } = await supabase
      .from('facility_blocks')
      .select('id, start_time, end_time, reason')
      .eq('facility_id', facilityId)
      .eq('block_type', 'event_hold')
      .gte('end_time', new Date().toISOString())

    if (eventsError || bookingsError || blocksError) {
      console.error('Error fetching facility schedule:', { eventsError, bookingsError, blocksError })
      return NextResponse.json({ error: 'Failed to fetch schedule data' }, { status: 500 })
    }

    return NextResponse.json({
      school_events: (schoolEvents || []).map(e => ({
        date: e.booking_date,
        start: e.start_time,
        end: e.end_time,
      })),
      bookings: (regularBookings || []).map(b => ({
        date: b.booking_date,
        start: b.start_time,
        end: b.end_time,
      })),
      blocks: (blocks || []).map(b => ({
        start: b.start_time,
        end: b.end_time,
        reason: b.reason
      }))
    })
  } catch (err) {
    console.error('Exception fetching school event schedule:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
