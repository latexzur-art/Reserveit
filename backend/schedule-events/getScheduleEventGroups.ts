import type { SupabaseClient } from '@supabase/supabase-js'

export interface ScheduleEventGroupFilters {
  status?: string
  block_category?: string
  facility_id?: string
  start_date?: string
  end_date?: string
}

export interface ScheduleEventGroupOptions {
  publicView: boolean
}

export interface ScheduleEventGroupSummary {
  group_id: string | null
  event_name: string
  block_category: string | null
  current_status: string
  created_by_name?: string
  created_by_id?: string
  dates: string[]
  facilities: { id: string; name: string; room_number: string }[]
  booking_ids?: string[]
}

/**
 * Groups bookings sharing a group_id into one summary entry (COALESCE(group_id, id) so legacy/PH
 * ungrouped rows -- group_id NULL -- each stay their own group of size 1, never merged together).
 * publicView strips booking_ids/created_by_name and, absent an explicit status filter, narrows to
 * auto_approved only so a non-privileged viewer doesn't see someone else's pending/cancellation
 * noise by default.
 */
export async function getScheduleEventGroups(
  supabase: SupabaseClient,
  filters: ScheduleEventGroupFilters,
  options: ScheduleEventGroupOptions
): Promise<ScheduleEventGroupSummary[]> {
  await supabase.rpc('auto_complete_past_bookings', {})

  let allowedBookingIds: string[] | null = null
  if (filters.facility_id) {
    const { data: links } = await supabase
      .from('booking_facilities')
      .select('booking_id')
      .eq('facility_id', filters.facility_id)
    allowedBookingIds = (links ?? []).map((l: any) => l.booking_id)
    if (allowedBookingIds.length === 0) return []
  }

  let query = supabase.from('bookings').select('*').eq('booking_type', 'school_event_block')

  const effectiveStatus = filters.status ?? (options.publicView ? 'auto_approved' : undefined)
  if (effectiveStatus) query = query.eq('current_status', effectiveStatus)
  if (filters.block_category) query = query.eq('block_category', filters.block_category)
  if (filters.start_date) query = query.gte('booking_date', filters.start_date)
  if (filters.end_date) query = query.lte('booking_date', filters.end_date)
  if (allowedBookingIds) query = query.in('id', allowedBookingIds)

  const { data: rows, error } = await query
  if (error) throw error
  const bookingRows: any[] = rows ?? []
  if (bookingRows.length === 0) return []

  const bookingIds = bookingRows.map((r) => r.id)
  const { data: facilityLinks } = await supabase
    .from('booking_facilities')
    .select('booking_id, facility_id')
    .in('booking_id', bookingIds)
  const links: { booking_id: string; facility_id: string }[] = facilityLinks ?? []

  const facilityIds = [...new Set(links.map((l) => l.facility_id))]
  const { data: facilityRows } = facilityIds.length
    ? await supabase.from('facilities').select('id, name, room_number').in('id', facilityIds)
    : { data: [] }
  const facilityById = new Map((facilityRows ?? []).map((f: any) => [f.id, f]))

  const userIds = [...new Set(bookingRows.map((r) => r.user_id))]
  const nameById = new Map<string, string>()
  if (!options.publicView && userIds.length > 0) {
    const { data: userRows } = await supabase.from('users').select('id, full_name, email').in('id', userIds)
    for (const u of userRows ?? []) nameById.set(u.id, u.full_name ?? u.email)
  }

  const groups = new Map<string, ScheduleEventGroupSummary & { _key: string }>()
  for (const row of bookingRows) {
    const key = row.group_id ?? `__row__${row.id}`
    let group = groups.get(key)
    if (!group) {
      group = {
        _key: key,
        group_id: row.group_id ?? null,
        event_name: row.event_name,
        block_category: row.block_category ?? null,
        current_status: row.current_status,
        created_by_name: options.publicView ? undefined : nameById.get(row.user_id),
        created_by_id: options.publicView ? undefined : row.user_id,
        dates: [],
        facilities: [],
        booking_ids: options.publicView ? undefined : [],
      }
      groups.set(key, group)
    }
    if (!group.dates.includes(row.booking_date)) group.dates.push(row.booking_date)
    if (!options.publicView) group.booking_ids!.push(row.id)

    for (const l of links.filter((lk) => lk.booking_id === row.id)) {
      const facility = facilityById.get(l.facility_id)
      if (facility && !group.facilities.some((f) => f.id === facility.id)) {
        group.facilities.push(facility)
      }
    }
  }

  return [...groups.values()].map(({ _key, ...summary }) => summary)
}
