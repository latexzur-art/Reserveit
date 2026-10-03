import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUserManager } from '@/lib/auth/guards'
/**
 * P1-1: Surface frequent same-day cancellers to admins.
 *
 * Returns users ranked by their count of user-initiated cancellations made
 * within 12 hours of the booking start, in the last 30 days. No automatic
 * penalty — admins decide whether to act.
 *
 * Query params:
 *   - days  (default 30): lookback window
 *   - limit (default 50): max users
 */
export async function GET(request: NextRequest) {
  const { error } = await requireUserManager()
  if (error) return error

  const url = new URL(request.url)
  const days = Math.max(1, Math.min(365, Number.parseInt(url.searchParams.get('days') ?? '30', 10)))
  const limit = Math.max(1, Math.min(200, Number.parseInt(url.searchParams.get('limit') ?? '50', 10)))

  try {
    const supabase = createAdminClient()
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: rows, error: queryError } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        user_id,
        booking_date,
        start_time,
        cancelled_at,
        cancellation_lead_time_hours,
        cancellation_type,
        users!bookings_user_id_fkey!inner(id, full_name, email, account_status, consecutive_cancellations)
      `)
      .eq('cancellation_type', 'user_cancelled')
      .lt('cancellation_lead_time_hours', 12)
      .gte('cancelled_at', since)
      .order('cancelled_at', { ascending: false })

    if (queryError) throw queryError

    type Row = {
      id: string
      booking_reference: string
      user_id: string
      booking_date: string
      start_time: string
      cancelled_at: string
      cancellation_lead_time_hours: number
      users: {
        id: string
        full_name: string
        email: string
        account_status: string
        consecutive_cancellations: number
      } | { id: string; full_name: string; email: string; account_status: string; consecutive_cancellations: number }[]
    }

    type UserSummary = {
      user_id: string
      full_name: string
      email: string
      account_status: string
      consecutive_cancellations: number
      same_day_count: number
      most_recent_cancellation_at: string
      bookings: Array<{
        booking_reference: string
        booking_date: string
        start_time: string
        cancelled_at: string
        lead_time_hours: number
      }>
    }

    const summaries = new Map<string, UserSummary>()
    for (const r of (rows ?? []) as Row[]) {
      const u = Array.isArray(r.users) ? r.users[0] : r.users
      if (!u) continue
      const existing = summaries.get(u.id)
      const bookingEntry = {
        booking_reference: r.booking_reference,
        booking_date: r.booking_date,
        start_time: r.start_time,
        cancelled_at: r.cancelled_at,
        lead_time_hours: r.cancellation_lead_time_hours,
      }
      if (existing) {
        existing.same_day_count += 1
        existing.bookings.push(bookingEntry)
      } else {
        summaries.set(u.id, {
          user_id: u.id,
          full_name: u.full_name,
          email: u.email,
          account_status: u.account_status,
          consecutive_cancellations: u.consecutive_cancellations,
          same_day_count: 1,
          most_recent_cancellation_at: r.cancelled_at,
          bookings: [bookingEntry],
        })
      }
    }

    const ranked = [...summaries.values()]
      .sort((a, b) =>
        b.same_day_count - a.same_day_count ||
        Date.parse(b.most_recent_cancellation_at) - Date.parse(a.most_recent_cancellation_at)
      )
      .slice(0, limit)

    return NextResponse.json({
      window_days: days,
      total_users: ranked.length,
      total_cancellations: rows?.length ?? 0,
      users: ranked,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] GET /admin/same-day-cancellations error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
