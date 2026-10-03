import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'

/**
 * Returns all dates in a given month that have active bookings or admin blocks
 * for a specific facility. Used by the client booking calendar to visually
 * indicate which dates are already reserved.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuthenticatedUser()
  if (error) return error

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Required: month (YYYY-MM)' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const [year, mon] = month.split('-').map(Number)
  const startDate = `${month}-01`
  const endDate = new Date(year, mon, 0).toISOString().slice(0, 10)

  const ACTIVE_STATUSES = [
    'pending', 'flagged', 'auto_approved', 'approved',
    'pending_user_response', 'cancellation_requested',
  ]

  const [bookingsResult, blocksResult] = await Promise.all([
    supabase
      .from('booking_facilities')
      .select('bookings!inner(booking_date)')
      .eq('facility_id', id)
      .gte('bookings.booking_date', startDate)
      .lte('bookings.booking_date', endDate)
      .in('bookings.current_status', ACTIVE_STATUSES),
    supabase
      .from('facility_blocks')
      .select('start_time, end_time')
      .eq('facility_id', id)
      .gte('end_time', `${startDate}T00:00:00Z`)
      .lte('start_time', `${endDate}T23:59:59Z`),
  ])

  if (bookingsResult.error || blocksResult.error) {
    console.error('[booked-dates] Query error:', bookingsResult.error ?? blocksResult.error)
    return NextResponse.json({ error: 'Failed to fetch booked dates' }, { status: 500 })
  }

  const dates = new Set<string>()

  for (const row of (bookingsResult.data ?? []) as any[]) {
    const d = row.bookings?.booking_date
    if (d) dates.add(d)
  }

  for (const block of (blocksResult.data ?? []) as any[]) {
    const blockStart = new Date(block.start_time)
    const blockEnd = new Date(block.end_time)
    const cur = new Date(blockStart)
    cur.setUTCHours(0, 0, 0, 0)
    const end = new Date(blockEnd)
    end.setUTCHours(23, 59, 59, 999)

    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10)
      if (ds >= startDate && ds <= endDate) dates.add(ds)
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
  }

  return NextResponse.json({ bookedDates: [...dates] })
}
