import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUserManager } from '@/lib/auth/guards'
export async function GET(_request: NextRequest) {
  const { error } = await requireUserManager()
  if (error) return error

  try {
    const supabase = createAdminClient()

    const { data, error: queryError } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        booking_date,
        start_time,
        end_time,
        booking_purpose,
        purpose,
        current_status,
        decision_score,
        oversight_expires_at,
        created_at,
        user:users(id, full_name, email, user_type, account_status),
        booking_facilities(
          facility:facilities(id, name, room_number, floors(floor_number, buildings(name)))
        ),
        booking_decisions(
          final_score, decision, decision_reason, score_adjustments
        )
      `)
      .in('current_status', ['auto_approved', 'flagged'])
      .gt('oversight_expires_at', new Date().toISOString())
      .order('current_status', { ascending: false })  // flagged first
      .order('oversight_expires_at', { ascending: true }) // soonest expiry first

    if (queryError) throw queryError

    return NextResponse.json({ bookings: data ?? [], total: (data ?? []).length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] GET /admin/oversight error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
