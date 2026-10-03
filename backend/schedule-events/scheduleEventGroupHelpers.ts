import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScheduleEventActorRole } from './createScheduleEventGroup'

/** Real-session role, never a client-supplied field. academic_head takes precedence when a user holds both. */
export function resolveActorRole(user: { roles?: { name: string }[] | null }): ScheduleEventActorRole {
  const roles = (user.roles ?? []).map((r) => r.name)
  return roles.includes('academic_head') ? 'academic_head' : 'building_admin'
}

export interface GroupRow {
  id: string
  group_id: string | null
  event_name: string
  booking_date: string
  start_time: string
  end_time: string
  current_status: string
  user_id: string
  block_category: string | null
  event_requires_approval?: boolean | null
  event_approval_status?: string | null
  event_requested_by_role?: string | null
  event_decided_by?: string | null
  event_decided_at?: string | null
  event_decision_notes?: string | null
  [k: string]: any
}

export async function fetchGroupRows(supabase: SupabaseClient, groupId: string): Promise<GroupRow[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('group_id', groupId)
    .eq('booking_type', 'school_event_block')
  if (error) throw error
  return data ?? []
}

export async function fetchFacilityIdsByBookingDate(
  supabase: SupabaseClient,
  rows: GroupRow[]
): Promise<Map<string, { anchorBookingId: string; facilityIds: string[] }>> {
  const { data } = await supabase
    .from('booking_facilities')
    .select('booking_id, facility_id')
    .in('booking_id', rows.map((r) => r.id))
  const links: { booking_id: string; facility_id: string }[] = data ?? []

  const byDate = new Map<string, { anchorBookingId: string; facilityIds: string[] }>()
  for (const row of rows) {
    const entry = byDate.get(row.booking_date) ?? { anchorBookingId: row.id, facilityIds: [] }
    const facilityIds = links.filter((l) => l.booking_id === row.id).map((l) => l.facility_id)
    entry.facilityIds.push(...facilityIds)
    byDate.set(row.booking_date, entry)
  }
  return byDate
}

export async function fetchUsersByRole(
  supabase: SupabaseClient,
  role: string
): Promise<{ email: string; full_name: string | null }[]> {
  const { data } = await supabase
    .from('user_roles')
    .select('users!inner(email, full_name), roles!inner(name)')
    .eq('roles.name', role)
    .eq('is_active', true)

  return ((data ?? []) as any[])
    .map((r) => (Array.isArray(r.users) ? r.users[0] : r.users))
    .filter((u): u is { email: string; full_name: string | null } => !!u?.email)
}

export function summarizeDates(rows: GroupRow[]): string {
  return [...new Set(rows.map((r) => r.booking_date))].sort().join(', ')
}
