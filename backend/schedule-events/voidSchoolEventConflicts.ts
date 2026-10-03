import type { SupabaseClient } from '@supabase/supabase-js'
import { applySchoolEventBlock } from './applySchoolEventBlock'

export { timeToMinutes } from './applySchoolEventBlock'

export interface VoidConflictsResult {
  bookingsVoided: number
  schedulesVoided: number
}

/**
 * @deprecated Use applySchoolEventBlock with mode='offer_reschedule' directly.
 * This wrapper kept for callers that haven't migrated yet.
 */
export async function voidConflictsForSchoolEvent(
  supabase: SupabaseClient,
  facility_ids: string[],
  booking_date: string,
  start_time: string,
  end_time: string,
  event_name: string,
  event_booking_id?: string,
  mode: 'offer_reschedule' | 'hard_cancel' = 'offer_reschedule',
): Promise<VoidConflictsResult> {
  const result = await applySchoolEventBlock(
    supabase,
    facility_ids,
    booking_date,
    start_time,
    end_time,
    event_name,
    event_booking_id ?? '',
    mode,
  )
  return {
    bookingsVoided: result.bookingsAffected,
    schedulesVoided: result.schedulesAffected,
  }
}
