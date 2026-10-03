import type { SupabaseClient } from '@supabase/supabase-js'

export type ConflictCheckParams = {
  facility_id: string
  booking_date: string
  start_time: string
  end_time: string
  /** Booking ID to exclude from the conflict search (e.g. when re-proposing the same booking). */
  exclude_booking_id?: string
}

export type ConflictResult =
  | { conflict: false }
  | { conflict: true; conflicting_booking_reference?: string }

const ACTIVE_STATUSES = ['pending', 'flagged', 'auto_approved', 'approved', 'pending_faculty_response', 'pending_user_response', 'cancellation_requested', 'on_hold']

export async function checkBookingConflict(
  supabase: SupabaseClient,
  params: ConflictCheckParams,
): Promise<ConflictResult> {
  let query = supabase
    .from('booking_facilities')
    .select('booking_id, bookings!inner(id, booking_reference, start_time, end_time, current_status)')
    .eq('facility_id', params.facility_id)
    .eq('bookings.booking_date', params.booking_date)
    .in('bookings.current_status', ACTIVE_STATUSES)
    .lt('bookings.start_time', params.end_time)
    .gt('bookings.end_time', params.start_time)

  if (params.exclude_booking_id) {
    query = query.neq('booking_id', params.exclude_booking_id)
  }

  const { data } = await query.limit(1)

  if (!data || data.length === 0) return { conflict: false }

  const booking = Array.isArray(data[0].bookings) ? data[0].bookings[0] : data[0].bookings
  return {
    conflict: true,
    conflicting_booking_reference: (booking as { booking_reference?: string } | null)?.booking_reference,
  }
}
