/**
 * Server-side tool executors.
 * @module backend/ai/tools/executors
 */

import { getManilaTodayISO } from '@/lib/timezone'
import { listFacilitiesWithAvailability } from '@/backend/booking/availabilityQuery'
import { previewBookingScore, type PreviewFields } from '@/backend/booking/scorePreview'
import { rateRoom } from '@/backend/booking/roomRating'
import type { AssistantToolName } from '@/backend/ai/roleCapabilities'
import { LOOKUP_ENDPOINTS, TERMINAL_TOOL, type ToolContext } from './definitions'
import { getRecentBookings } from './memory'
import { planViewPerson, assembleViewPerson } from './viewPerson'

const POLICIES: Record<string, string> = {
  hours: 'Standard school bookings run 07:00–19:00, Monday–Saturday. Sundays are not allowed for standard bookings. Paid facilities (e.g. Gymnasium) have no day/time restriction.',
  scoring: 'Bookings are graded 0–100. ≥80 auto-approves; 35–79 goes to admin review; below 35 is auto-declined. Academic purpose, a clear detailed purpose, a booking reason/justification, and a room that matches the session type all raise the score. Same-day bookings, peak hours (08–09, 12–13), weekends, and >4h durations lower it.',
  paid: 'Paid/rental facilities (Gymnasium) require Building Head approval and payment — they are NOT auto-graded. Rates are per hour and differ AM vs PM.',
  sundays: 'Sunday bookings are not allowed for standard school facilities. Paid facilities may be booked any day.',
  advance: 'Bookings must be within the facility advance-booking window (default 14 days) and inside the active academic term for academic/department use.',
  mismatch: 'Booking a specialized facility (computer lab, science lab, AV studio) outside your primary department, or a lecture in a lab, routes the booking to the Academic Head for review.',
}

function getPolicies(topic?: string): string {
  if (topic && POLICIES[topic.toLowerCase()]) return POLICIES[topic.toLowerCase()]
  return Object.values(POLICIES).join(' ')
}

// ─── Field merge helper ────────────────────────────────────────────────────────
function mergeFields(base: PreviewFields, override: Record<string, unknown>): PreviewFields {
  const str = (v: unknown, fallback: string | null | undefined) =>
    typeof v === 'string' && v.trim() ? v.trim() : (fallback ?? null)
  const num = (v: unknown, fallback: number | null | undefined) =>
    typeof v === 'number' && v > 0 ? Math.round(v) : (fallback ?? null)
  return {
    facility_id: str(override.facility_id, base.facility_id),
    booking_date: str(override.booking_date, base.booking_date),
    start_time: str(override.start_time, base.start_time),
    end_time: str(override.end_time, base.end_time),
    booking_purpose: str(override.booking_purpose, base.booking_purpose),
    expected_attendees: num(override.expected_attendees, base.expected_attendees),
    purpose: str(override.purpose, base.purpose),
    event_name: str(override.event_name, base.event_name),
    special_requests: str(override.special_requests, base.special_requests),
    facility_purpose_category: str(override.facility_purpose_category, base.facility_purpose_category),
    mismatch_justification: str(override.mismatch_justification, base.mismatch_justification),
    booking_course_code: str(override.booking_course_code, base.booking_course_code),
    booking_department_code: str(override.booking_department_code, base.booking_department_code),
    session_type:
      override.session_type === 'lecture' || override.session_type === 'lab'
        ? override.session_type
        : base.session_type ?? null,
  }
}

// ─── Tool schemas ──────────────────────────────────────────────────────────────
function compact(value: unknown): unknown {
  if (Array.isArray(value)) {
    const head = value.slice(0, 10).map(compact)
    return value.length > 10 ? { items: head, total: value.length, note: `showing 10 of ${value.length}` } : head
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = compact(v)
    return out
  }
  return value
}

/** Per-tool proxy timeout — one slow endpoint must not stall the whole turn. */
const PROXY_TIMEOUT_MS = 8000

async function proxyGet(ctx: ToolContext, path: string, query: Record<string, string>): Promise<unknown> {
  if (!ctx.origin) return { error: 'lookup unavailable in this context' }
  try {
    const url = new URL(path, ctx.origin)
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
    const res = await fetch(url.toString(), {
      headers: ctx.cookie ? { cookie: ctx.cookie } : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    })
    const text = await res.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = text
    }
    if (!res.ok) {
      const errMsg = (json as { error?: string } | null)?.error ?? `lookup failed (${res.status})`
      return { error: errMsg }
    }
    return compact(json)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'lookup failed' }
  }
}

const LOOKUP_NAMES = new Set<string>(Object.keys(LOOKUP_ENDPOINTS))

/** Tool names that return role-scoped data (for the chat route to surface in `data`). */
export const LOOKUP_TOOL_NAMES: ReadonlySet<string> = new Set<string>([...LOOKUP_NAMES, 'view_person'])

// ─── Executor ────────────────────────────────────────────────────────────────
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const { supabase, userProfile, currentFields } = ctx

  // Role lookups: gate by capability, then proxy to the existing endpoint.
  if (LOOKUP_NAMES.has(name)) {
    if (!ctx.caps.tools.includes(name as AssistantToolName)) {
      return { error: 'This lookup is not available for your role.' }
    }
    const ep = LOOKUP_ENDPOINTS[name as AssistantToolName]
    if (!ep) return { error: `Unknown lookup: ${name}` }
    const query: Record<string, string> = { ...(ep.defaults ?? {}) }
    // Resolve {param} placeholders in the path from args (e.g. /api/reports/{report_id}/logs)
    let resolvedPath = ep.path
    for (const m of ep.path.matchAll(/\{(\w+)\}/g)) {
      const key = m[1]
      const v = args[key]
      if (typeof v === 'string' && v.trim()) {
        resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(v.trim()))
      }
    }
    for (const p of ep.params ?? []) {
      const v = args[p]
      if (typeof v === 'string' && v.trim()) query[p] = v.trim()
    }
    return proxyGet(ctx, resolvedPath, query)
  }

  switch (name) {
    case 'search_availability': {
      const date = typeof args.date === 'string' ? args.date : null
      if (!date) return { error: 'date is required (YYYY-MM-DD)' }
      const start = typeof args.start === 'string' ? args.start : null
      const end = typeof args.end === 'string' ? args.end : null
      const hint = typeof args.facility_hint === 'string' ? args.facility_hint.toLowerCase() : null

      const all = await listFacilitiesWithAvailability(supabase, { date, start, end })
      let available = all.filter((f) => f.is_available)
      if (hint) available = available.filter((f) => f.name.toLowerCase().includes(hint))
      const takenCount = all.length - all.filter((f) => f.is_available).length
      return {
        date,
        window: start && end ? `${start}-${end}` : 'any time',
        available_rooms: available.slice(0, 12).map((f) => ({
          name: f.name,
          type: f.facility_type_name,
          capacity: f.capacity,
          floor: f.floor_name,
          paid: f.is_paid_facility,
        })),
        available_count: available.length,
        taken_count: start && end ? takenCount : undefined,
      }
    }

    case 'get_my_bookings': {
      const tf = (['upcoming', 'past', 'all'] as const).includes(args.timeframe as 'upcoming' | 'past' | 'all')
        ? (args.timeframe as 'upcoming' | 'past' | 'all')
        : 'all'
      // User-owned read → RLS-scoped client (least privilege); admin as fallback.
      const rows = await getRecentBookings(ctx.supabaseUser ?? supabase, userProfile.id, tf)
      return { timeframe: tf, count: rows.length, bookings: rows }
    }

    case 'get_booking_policies':
      return { policy: getPolicies(typeof args.topic === 'string' ? args.topic : undefined) }

    case 'score_booking': {
      const fields = mergeFields(currentFields, args)
      const preview = await previewBookingScore(supabase, userProfile, fields)
      return preview
    }

    case 'suggest_room': {
      const date = typeof args.date === 'string' ? args.date : currentFields.booking_date
      const start = typeof args.start === 'string' ? args.start : currentFields.start_time
      const end = typeof args.end === 'string' ? args.end : currentFields.end_time
      if (!date) return { error: 'date is required to suggest a room' }

      const purpose = typeof args.booking_purpose === 'string' ? args.booking_purpose : currentFields.booking_purpose
      const attendees = typeof args.expected_attendees === 'number' ? args.expected_attendees : currentFields.expected_attendees ?? null
      const sessionType = (args.session_type === 'lecture' || args.session_type === 'lab')
        ? args.session_type
        : currentFields.session_type ?? null
      const courseCode = typeof args.booking_course_code === 'string' ? args.booking_course_code : currentFields.booking_course_code ?? null
      const preferPaid = args.prefer_paid === true

      const all = await listFacilitiesWithAvailability(supabase, { date, start, end })
      let candidates = all.filter((f) => f.is_available && (preferPaid || !f.is_paid_facility))
      if (!preferPaid) {
        // Only keep paid out; if nothing left (rare), fall back to all available
        if (candidates.length === 0) candidates = all.filter((f) => f.is_available)
      }

      const rated = candidates
        .map((f) => ({
          room: f,
          rating: rateRoom(
            {
              id: f.id,
              name: f.name,
              facility_type_name: f.facility_type_name,
              capacity: f.capacity,
              is_paid_facility: f.is_paid_facility,
              specialized_tag: f.specialized_tag,
            },
            { booking_purpose: purpose, expected_attendees: attendees, session_type: sessionType, booking_course_code: courseCode }
          ),
        }))
        .sort((a, b) => b.rating.rating - a.rating.rating)

      if (rated.length === 0) return { error: 'No available rooms for that date/time. Try another slot.' }

      const toOut = (r: (typeof rated)[number]) => ({
        facility_id: r.room.id,
        facility_name: r.room.name,
        type: r.room.facility_type_name,
        capacity: r.room.capacity,
        floor: r.room.floor_name,
        is_paid_facility: r.room.is_paid_facility,
        specialized_tag: r.room.specialized_tag,
        rating: r.rating.rating,
        stars: r.rating.stars,
        reasons: r.rating.reasons,
      })

      return { best: toOut(rated[0]), alternatives: rated.slice(1, 4).map(toOut) }
    }

    case 'view_person': {
      if (!ctx.caps.tools.includes('view_person')) {
        return { error: 'This lookup is not available for your role.' }
      }
      const plan = planViewPerson(ctx.caps.role)
      if (!plan) return { error: 'Person lookup is not available for your role.' }
      const search = typeof args.search === 'string' ? args.search : undefined
      const user_id = typeof args.user_id === 'string' ? args.user_id : undefined
      const result = await assembleViewPerson(plan, { search, user_id }, (path, query) => proxyGet(ctx, path, query))
      return compact(result)
    }

    case TERMINAL_TOOL:
      // Handled by the chat route loop; never executed here.
      return { error: 'emit_result is terminal and handled by the caller' }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}
