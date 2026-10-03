/**
 * Pure helpers backing the professor "Report equipment issue" dialog.
 *
 * Reports are decoupled from reservations — a professor files against the room
 * they use for a fixed class schedule, not a booking. Capturing a structured
 * facilityId (and, when known, equipmentId) is what lets the server derive
 * `is_tech` and route the escalation to the right office (PAMO vs IT Admin)
 * instead of defaulting every professor report to PAMO.
 */

export interface IssueReportFormState {
  category: string
  description: string
  /** Structured room chosen from the reporter's class schedule. */
  facilityId?: string | null
  /** Structured item chosen from the room's equipment. */
  equipmentId?: string | null
  /** Free-text "Room / equipment code" fallback when nothing structured is picked. */
  location?: string | null
}

export interface IssueReportPayload {
  category: string
  description: string
  facilityId?: string
  equipmentId?: string
}

/**
 * Build the POST body for `/api/equipment-reports`. Structured identifiers win;
 * the free-text location is only folded into the description when no facility
 * was selected (preserving the original free-text behavior as a fallback).
 */
export function buildIssueReportPayload(state: IssueReportFormState): IssueReportPayload {
  const payload: IssueReportPayload = {
    category: state.category,
    description: state.description,
  }

  if (state.facilityId) payload.facilityId = state.facilityId
  if (state.equipmentId) payload.equipmentId = state.equipmentId

  if (!state.facilityId && state.location && state.location.trim()) {
    payload.description = `[${state.location.trim()}] ${state.description}`
  }

  return payload
}

export interface ScheduleRoom {
  facilityId: string
  label: string
}

/** A joined facility can arrive as an object or a single-element array from Supabase. */
function firstFacility(facilities: any): any | null {
  if (!facilities) return null
  return Array.isArray(facilities) ? facilities[0] ?? null : facilities
}

/**
 * Distinct rooms from a `/api/schedules/my-classes` response — the source for
 * the dialog's room picker. Each class carries a flattened `facility` object;
 * a raw supabase `facilities` join (object or single-element array) is also
 * tolerated. Classes with no assigned facility are skipped.
 */
export function roomsFromClasses(classes: any[]): ScheduleRoom[] {
  const seen = new Map<string, ScheduleRoom>()
  for (const cls of classes ?? []) {
    const facility = cls?.facility ?? firstFacility(cls?.facilities)
    const facilityId: string | null = facility?.id ?? cls?.facility_id ?? null
    if (!facilityId || seen.has(facilityId)) continue
    const name: string | undefined =
      facility?.name && facility.name !== 'Unknown' ? facility.name : undefined
    const roomNumber: string | undefined = facility?.room_number || undefined
    const building: string | undefined = facility?.building || undefined
    const base = name || (roomNumber ? `Room ${roomNumber}` : facilityId)
    const label = building ? `${base} · ${building}` : base
    seen.set(facilityId, { facilityId, label })
  }
  return Array.from(seen.values())
}
