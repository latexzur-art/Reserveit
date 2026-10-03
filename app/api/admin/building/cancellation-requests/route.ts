import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') ?? 'pending'

  const supabase = createAdminClient()

  try {
    let query = supabase
      .from('cancellation_requests')
      .select(`
        id,
        booking_id,
        user_id,
        reason,
        status,
        original_status,
        reviewed_by,
        reviewed_at,
        review_notes,
        auto_approved,
        refund_window_met,
        refund_destination_name,
        refund_destination_contact_number,
        refund_destination_qr_url,
        created_at,
        users!cancellation_requests_user_id_fkey(full_name, email, contact_number),
        bookings!cancellation_requests_booking_id_fkey(
          id,
          booking_reference,
          booking_date,
          start_time,
          end_time,
          current_status,
          total_price,
          booking_facilities(facility_id, facilities(name))
        )
      `)
      .not('refund_destination_name', 'is', null)
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error: queryError } = await query

    if (queryError) {
      console.error('[API] GET /admin/building/cancellation-requests query error:', queryError.message)
      return NextResponse.json({ error: 'Failed to fetch cancellation requests' }, { status: 500 })
    }

    return NextResponse.json({ requests: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] GET /admin/building/cancellation-requests error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
