import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUserManager } from '@/lib/auth/guards'
export async function GET(request: NextRequest) {
  const { error } = await requireUserManager()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  try {
    const supabase = createAdminClient()

    const { data, error: queryError, count } = await supabase
      .from('booking_decisions')
      .select(`
        id,
        hard_constraints_passed,
        hard_constraint_failed_code,
        base_score,
        score_adjustments,
        final_score,
        decision,
        decision_reason,
        pipeline_version,
        processing_time_ms,
        created_at,
        booking:bookings(
          id, booking_reference, booking_date, start_time, end_time,
          booking_purpose, current_status,
          user:users!bookings_user_id_fkey(id, full_name, email)
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (queryError) throw queryError

    return NextResponse.json({ decisions: data ?? [], total: count ?? 0, limit, offset })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] GET /admin/recent-decisions error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
