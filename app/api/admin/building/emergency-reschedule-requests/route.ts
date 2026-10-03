import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { searchParams } = request.nextUrl
  const statusParam = searchParams.get('status') ?? 'pending,pending_extra_payment,awaiting_reschedule'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  try {
    const supabase = createAdminClient()
    const statuses = statusParam === 'all' ? ['all'] : statusParam.split(',').map(s => s.trim()).filter(Boolean)
    const includeAwaiting = statusParam === 'all' || statuses.includes('awaiting_reschedule') || statusParam.includes('pending')
    const onlyAwaiting = statuses.length === 1 && statuses[0] === 'awaiting_reschedule'

    let emergencyItems: any[] = []
    let emergencyCount = 0

    if (!onlyAwaiting) {
      let query = supabase
        .from('emergency_reschedule_requests')
        .select(`
          id, status, reason, attachment_url,
          proposed_date, proposed_start_time, proposed_end_time,
          original_date, original_start_time, original_end_time,
          extra_amount_centavos, review_notes, created_at, reviewed_at,
          extra_payment_id, booking_id,
          user:user_id(id, full_name, email),
          booking:booking_id(
            id, booking_reference, booking_date, start_time, end_time, current_status, reschedule_deadline,
            booking_facilities(facility_id, facilities(name))
          ),
          reviewer:reviewed_by(full_name)
        `, { count: 'exact' })

      const emergencyStatuses = statuses.filter(s => s !== 'awaiting_reschedule')
      if (emergencyStatuses.length > 0 && !emergencyStatuses.includes('all')) {
        if (emergencyStatuses.length === 1) {
          query = query.eq('status', emergencyStatuses[0])
        } else {
          query = query.in('status', emergencyStatuses)
        }
      }

      const { data, count } = await query.order('created_at', { ascending: false })
      emergencyItems = (data ?? []).map(item => ({ ...item, request_type: 'emergency_reschedule' }))
      emergencyCount = count ?? emergencyItems.length
    }

    let awaitingItems: any[] = []
    if (includeAwaiting) {
      const { data: awaitingBookings } = await supabase
        .from('bookings')
        .select(`
          id, booking_reference, current_status, reschedule_deadline,
          original_date, original_start_time, original_end_time,
          booking_date, start_time, end_time, created_at, updated_at,
          user:user_id(id, full_name, email),
          booking_facilities(facility_id, facilities(name)),
          block_event:block_event_id(event_name)
        `)
        .eq('current_status', 'awaiting_reschedule')
        .order('updated_at', { ascending: false })

      awaitingItems = (awaitingBookings ?? []).map(b => {
        const blockEvent = Array.isArray(b.block_event) ? b.block_event[0] : b.block_event
        const eventName = (blockEvent as any)?.event_name
        return {
          id: `awaiting-${b.id}`,
          booking_id: b.id,
          request_type: 'awaiting_reschedule',
          status: 'awaiting_reschedule',
          reason: eventName
            ? `Displaced by School Event: ${eventName}`
            : 'Awaiting user slot selection (reschedule requested)',
          attachment_url: null,
          proposed_date: null,
          proposed_start_time: null,
          proposed_end_time: null,
          original_date: b.original_date ?? b.booking_date,
          original_start_time: (b.original_start_time ?? b.start_time)?.slice(0, 5),
          original_end_time: (b.original_end_time ?? b.end_time)?.slice(0, 5),
          extra_amount_centavos: 0,
          review_notes: null,
          reschedule_deadline: b.reschedule_deadline,
          created_at: b.updated_at ?? b.created_at,
          user: b.user ? { id: (b.user as any).id, full_name: (b.user as any).full_name, email: (b.user as any).email } : null,
          booking: {
            id: b.id,
            booking_reference: b.booking_reference,
            booking_date: b.booking_date,
            start_time: b.start_time,
            end_time: b.end_time,
            current_status: b.current_status,
            reschedule_deadline: b.reschedule_deadline,
            booking_facilities: b.booking_facilities,
          },
        }
      })
    }

    const combined = [...emergencyItems, ...awaitingItems].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const paginated = combined.slice(offset, offset + limit)

    return NextResponse.json({ requests: paginated, total: combined.length })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
