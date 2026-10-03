import { NextRequest, NextResponse } from 'next/server'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { id: __rawId } = await params
  const __idParsed = parseUuidParam(__rawId, 'booking id')
  if (!__idParsed.ok) return __idParsed.response
  const id = __idParsed.value

  // Determine admin status before querying so non-admins are filtered at the DB level
  const roles = (user.roles ?? []).map((r: { name: string }) => r.name)
  const isAdmin = roles.some((r: string) => ['building_admin', 'academic_head', 'it_admin'].includes(r))

  try {
    const supabase = createAdminClient()

    let bookingQuery = supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        booking_date,
        start_time,
        end_time,
        booking_type,
        booking_purpose,
        purpose,
        event_name,
        expected_attendees,
        special_requests,
        self_facilitation_confirmed,
        facilitator_name,
        current_status,
        decision_score,
        oversight_expires_at,
        cancellation_type,
        internal_notes,
        requires_payment,
        submitted_at,
        approved_at,
        rejected_at,
        cancelled_at,
        completed_at,
        created_at,
        user_id,
        booking_facilities(
          facility:facilities(
            id, name, room_number, capacity,
            floors(floor_number, buildings(name))
          )
        ),
        booking_equipment(
          equipment:equipment(id, name, equipment_types(name))
        ),
        booking_decisions(
          id,
          hard_constraints_passed,
          hard_constraint_failed_code,
          hard_constraint_details,
          base_score,
          score_adjustments,
          final_score,
          decision,
          decision_reason,
          pipeline_version,
          processing_time_ms,
          created_at
        )
      `)
      .eq('id', id)

    // Non-admins: filter at DB level as defense-in-depth before any data is returned
    if (!isAdmin) {
      bookingQuery = bookingQuery.eq('user_id', user.id)
    }

    const { data: booking, error: queryError } = await bookingQuery.single()

    if (queryError) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Redundant guard kept as safety net
    if (!isAdmin && booking.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch status history via DB function
    const { data: statusHistory } = await supabase.rpc('get_booking_status_history', {
      p_booking_id: id,
    })

    return NextResponse.json({ booking, statusHistory: statusHistory ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] GET /bookings/[id] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
