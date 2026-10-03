import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { getErrorMessage } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const { error } = await requireBuildingAdminStrict()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status') || 'pending'
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)
  const offset = Math.max(Number(searchParams.get('offset') ?? '0'), 0)
  const countOnly = searchParams.get('count') === '1'

  try {
    const supabase = createAdminClient()

    let query = supabase
      .from('emergency_cancellation_requests')
      .select(`
        id, status, reason, attachment_url, review_notes,
        created_at, reviewed_at, issued_credit_id,
        user:users!emergency_cancellation_requests_user_id_fkey (
          id, full_name, email
        ),
        booking:bookings!emergency_cancellation_requests_booking_id_fkey (
          id, booking_reference, booking_date, start_time, end_time, requires_payment,
          booking_facilities (
            facilities ( name )
          )
        ),
        reviewer:users!emergency_cancellation_requests_reviewed_by_fkey (
          full_name
        )
      `, { count: 'exact' })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter) as typeof query
    }

    if (countOnly) {
      const { count } = await query.limit(0)
      return NextResponse.json({ count: count ?? 0 })
    }

    const { data, count, error: queryError } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    // Attach completed payment totals for each request's booking
    const enriched = await Promise.all((data ?? []).map(async (req: any) => {
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('booking_id', req.booking?.id)
        .eq('payment_status', 'completed')

      const totalCentavos = (payments ?? []).reduce(
        (sum: number, p: any) => sum + Math.round(Number(p.amount) * 100),
        0
      )
      return { ...req, completed_payment_centavos: totalCentavos }
    }))

    return NextResponse.json({ requests: enriched, total: count ?? 0 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
