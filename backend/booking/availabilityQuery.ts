/**
 * Facility availability listing — shared by the AI tools and the
 * /api/ai/available-facilities route so the conflict logic lives in one place.
 * @module backend/booking/availabilityQuery
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface AvailableFacility {
  id: string
  name: string
  facility_type_name: string | null
  capacity: number
  floor_name: string | null
  description: string | null
  is_available: boolean
  is_paid_facility: boolean
  paid_booking_route: string | null
  specialized_tag: string | null
}

const SPECIALIZED_TAGS = ['computer_use', 'science_lab', 'av_studio', 'gym']

/**
 * List all active facilities, marking each available/taken for the given
 * date+time window (if provided). Mirrors the prior inline logic of
 * /api/ai/available-facilities.
 */
export async function listFacilitiesWithAvailability(
  supabase: SupabaseClient,
  opts: { date?: string | null; start?: string | null; end?: string | null }
): Promise<AvailableFacility[]> {
  const { date, start, end } = opts

  const { data: facilities, error } = await supabase
    .from('facilities')
    .select(`
      id,
      name,
      capacity,
      description,
      is_available_for_rental,
      facility_type:facility_type_id ( name ),
      floor:floor_id ( name ),
      facility_purpose_tags ( tag )
    `)
    .eq('is_active', true)
    .order('name')

  if (error) throw new Error(`facilities query failed: ${error.message}`)

  let bookedFacilityIds: string[] = []

  if (date && start && end) {
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('booking_facilities ( facility_id )')
      .eq('booking_date', date)
      .in('current_status', ['pending', 'approved', 'auto_approved'])
      .or(
        `and(start_time.lte.${start},end_time.gt.${start}),` +
        `and(start_time.lt.${end},end_time.gte.${end}),` +
        `and(start_time.gte.${start},end_time.lte.${end})`
      )

    if (conflicts) {
      bookedFacilityIds = conflicts.flatMap((b) =>
        ((b as { booking_facilities: { facility_id: string }[] }).booking_facilities ?? []).map(
          (bf) => bf.facility_id
        )
      )
    }

    const dayOfWeekInt = new Date(date).getDay()
    const { data: classConflicts } = await supabase
      .from('class_schedules')
      .select('facility_id')
      .eq('day_of_week', dayOfWeekInt)
      .eq('is_active', true)
      .lte('effective_start_date', date)
      .gte('effective_end_date', date)
      .lt('start_time', end)
      .gt('end_time', start)

    if (classConflicts) {
      bookedFacilityIds.push(
        ...classConflicts.map((c) => c.facility_id).filter((id): id is string => !!id)
      )
    }
  }

  return (facilities ?? []).map((f) => {
    const raw = f as unknown as {
      id: string
      name: string
      capacity: number
      description: string | null
      is_available_for_rental: boolean | null
      facility_type: { name: string } | null
      floor: { name: string } | null
      facility_purpose_tags: { tag: string }[] | null
    }
    const isPaid = raw.is_available_for_rental === true
    const allTags = (raw.facility_purpose_tags ?? []).map((t) => t.tag)
    const specializedTag = allTags.find((t) => SPECIALIZED_TAGS.includes(t)) ?? null
    return {
      id: raw.id,
      name: raw.name,
      facility_type_name: raw.facility_type?.name ?? null,
      capacity: raw.capacity,
      floor_name: raw.floor?.name ?? null,
      description: raw.description ?? null,
      is_available: !bookedFacilityIds.includes(raw.id),
      is_paid_facility: isPaid,
      paid_booking_route: isPaid ? '/internal/personal-gym-booking' : null,
      specialized_tag: specializedTag,
    }
  })
}
