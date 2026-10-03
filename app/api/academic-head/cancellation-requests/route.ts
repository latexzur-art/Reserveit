import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const hasRole = user.roles?.some((r: { name: string }) => r.name === 'academic_head')
  if (!hasRole) {
    return NextResponse.json({ error: 'Forbidden: academic_head role required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
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
        users!cancellation_requests_user_id_fkey(full_name, email),
        bookings!cancellation_requests_booking_id_fkey(booking_reference, booking_date, start_time, end_time, current_status, booking_facilities(facility_id, facilities(name)))
      `)
      .order('created_at', { ascending: false })

    // Academic Head only has authority over academic/unpaid bookings (no say in paid reservations)
    query = query.is('refund_destination_name', null)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error: queryError } = await query

    if (queryError) {
      console.error('[API] GET /academic-head/cancellation-requests query error:', queryError.message)
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
    }

    return NextResponse.json({ requests: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] GET /academic-head/cancellation-requests error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
