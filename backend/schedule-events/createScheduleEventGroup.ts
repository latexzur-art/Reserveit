import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applySchoolEventBlock } from './applySchoolEventBlock'

export type ScheduleEventMode = 'school_event' | 'exam_period'
export type ScheduleEventActorRole = 'academic_head' | 'building_admin'

export interface CreateScheduleEventGroupParams {
  mode: ScheduleEventMode
  event_name: string
  facility_ids?: string[]
  all_facilities?: boolean
  dates: string[]
  start_time: string
  end_time: string
  userId: string
  actorRole: ScheduleEventActorRole
}

export interface CreateScheduleEventGroupResult {
  group_id: string
  bookingsVoided: number
  schedulesVoided: number
  eventsCount: number
  status: 'auto_approved' | 'pending'
}

/**
 * Resolves `all_facilities` server-side (never trusts a client-supplied id list for it) and
 * creates one bookings row per date x facility, all sharing one group_id. When the actor is
 * building_admin, block/void effects run immediately per date -- and, fixing the block_event_id
 * bug, applySchoolEventBlock is called directly with the real first-row-of-the-date id instead of
 * the deprecated voidConflictsForSchoolEvent wrapper's '' default. When the actor is academic_head,
 * rows land pending and no void/displacement happens until a later approval (see spec §5).
 */
export async function createScheduleEventGroup(
  supabase: SupabaseClient,
  params: CreateScheduleEventGroupParams
): Promise<CreateScheduleEventGroupResult> {
  const { mode, event_name, dates, start_time, end_time, userId, actorRole } = params

  const facilityIds = params.all_facilities
    ? await resolveAllActiveFacilityIds(supabase)
    : params.facility_ids ?? []

  const group_id = randomUUID()
  const status: 'auto_approved' | 'pending' = actorRole === 'building_admin' ? 'auto_approved' : 'pending'

  let bookingsVoided = 0
  let schedulesVoided = 0
  let eventsCount = 0

  for (const date of dates) {
    const rowsToInsert = facilityIds.map(() => ({
      user_id: userId,
      booking_reference: '',
      booking_type: 'school_event_block',
      booking_purpose: 'school_event',
      booking_date: date,
      start_time,
      end_time,
      purpose: event_name,
      event_name,
      current_status: status,
      group_id,
      block_category: mode,
    }))

    const { data: insertedRows, error: insertError } = await supabase
      .from('bookings')
      .insert(rowsToInsert)
      .select('id')
    if (insertError) throw insertError

    const facilityRows = facilityIds.map((facilityId, i) => ({
      booking_id: insertedRows[i].id,
      facility_id: facilityId,
    }))
    if (facilityRows.length > 0) {
      const { error: facError } = await supabase.from('booking_facilities').insert(facilityRows)
      if (facError) throw facError
    }

    eventsCount += insertedRows.length

    if (actorRole === 'building_admin' && insertedRows.length > 0) {
      const anchorBookingId = insertedRows[0].id
      const { bookingsAffected, schedulesAffected } = await applySchoolEventBlock(
        supabase,
        facilityIds,
        date,
        start_time,
        end_time,
        event_name,
        anchorBookingId,
        'offer_reschedule'
      )
      bookingsVoided += bookingsAffected
      schedulesVoided += schedulesAffected
    }
  }

  return { group_id, bookingsVoided, schedulesVoided, eventsCount, status }
}

async function resolveAllActiveFacilityIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('facilities').select('id').eq('is_active', true)
  if (error) throw error
  return (data ?? []).map((f: any) => f.id)
}
