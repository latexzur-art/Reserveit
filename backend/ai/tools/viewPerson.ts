/**
 * `view_person` — one unified people lookup, role-scoped.
 *
 * An admin asks "show me Prof. X" and gets their profile in one place, plus the
 * facets their role is allowed to see (teaching schedule, their bookings,
 * payments, reliability). Each role reaches a different set of already-existing
 * endpoints; this module is the pure planner + assembler. The executor supplies
 * the actual (cookie-proxied) fetch.
 *
 * @module backend/ai/tools/viewPerson
 */

export interface ViewPersonFacet {
  name: string
  /** Endpoint path; a `{id}` placeholder is filled with the resolved person id. */
  path: string
  /** Optional query; values may contain `{name}` / `{search}` placeholders. */
  query?: Record<string, string>
}

export interface ViewPersonPlan {
  /** Directory endpoint used to resolve the person + read their profile row. */
  directory: { path: string; searchParam: string | null; rowsKey: string }
  /** Facet endpoints fetched after the person is resolved. */
  facets: ViewPersonFacet[]
}

const PLANS: Record<string, ViewPersonPlan> = {
  academic_head: {
    directory: { path: '/api/academic-head/academic-staff', searchParam: 'search', rowsKey: 'staff' },
    facets: [
      { name: 'schedule', path: '/api/academic-head/staff-schedules/{id}' },
      { name: 'bookings', path: '/api/academic-head/staff-bookings/{id}' },
      { name: 'reliability', path: '/api/academic-head/reliability', query: { search: '{name}' } },
    ],
  },
  building_admin: {
    directory: { path: '/api/admin/building/directory', searchParam: 'search', rowsKey: 'items' },
    facets: [
      { name: 'bookings', path: '/api/admin/building/directory/{id}/bookings' },
      { name: 'schedules', path: '/api/admin/building/directory/{id}/schedules' },
      { name: 'payments', path: '/api/admin/building/directory/{id}/payments' },
    ],
  },
  it_admin: {
    directory: { path: '/api/admin/users', searchParam: 'search', rowsKey: 'users' },
    facets: [],
  },
  program_head: {
    directory: { path: '/api/instructors', searchParam: null, rowsKey: 'instructors' },
    facets: [],
  },
}

/** Roles that expose the `view_person` tool. */
export const VIEW_PERSON_ROLES = Object.keys(PLANS)

/** The role's people-lookup plan, or null if the role has no directory surface. */
export function planViewPerson(role: string): ViewPersonPlan | null {
  return PLANS[role] ?? null
}

type GetJson = (path: string, query: Record<string, string>) => Promise<unknown>

function isErrorPayload(v: unknown): v is { error: string } {
  return !!v && typeof v === 'object' && 'error' in (v as Record<string, unknown>)
}

function rowsOf(json: unknown, key: string): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[]
  if (json && typeof json === 'object') {
    const rec = json as Record<string, unknown>
    for (const k of [key, 'items', 'users', 'staff', 'instructors', 'data']) {
      if (Array.isArray(rec[k])) return rec[k] as Record<string, unknown>[]
    }
  }
  return []
}

function rowId(r: Record<string, unknown>): string | null {
  const v = r.id ?? r.user_id ?? r.userId
  return v == null ? null : String(v)
}

function rowName(r: Record<string, unknown>): string {
  return String(r.name ?? r.full_name ?? r.email ?? '')
}

/** Order-independent token match over a row's name + email. */
function rowMatchesTokens(r: Record<string, unknown>, tokens: string[]): boolean {
  const hay = `${rowName(r)} ${String(r.email ?? '')}`.toLowerCase()
  return tokens.every((t) => hay.includes(t))
}

/**
 * Choose the most relevant match among fuzzy hits: an exact name/email wins,
 * then a name that starts with the query, else the first (directory-sorted) row.
 * Keeps full-name lookups from resolving to an alphabetical homonym.
 */
function pickBest(rows: Record<string, unknown>[], search: string): Record<string, unknown> | undefined {
  if (!search) return rows[0]
  const q = search.toLowerCase().trim()
  return (
    rows.find((r) => rowName(r).toLowerCase() === q || String(r.email ?? '').toLowerCase() === q) ??
    rows.find((r) => rowName(r).toLowerCase().startsWith(q)) ??
    rows[0]
  )
}

/**
 * Resolve the person (by explicit `user_id`, else the first search match) and
 * fan out to the plan's facets, substituting the resolved id/name. Returns a
 * `{ person, facets }` bundle or a `{ error }` — never throws for a miss.
 */
export async function assembleViewPerson(
  plan: ViewPersonPlan,
  args: { search?: string; user_id?: string },
  getJson: GetJson
): Promise<{ person: Record<string, unknown>; facets: Record<string, unknown> } | { error: string }> {
  const search = typeof args.search === 'string' ? args.search.trim() : ''
  const userId = typeof args.user_id === 'string' ? args.user_id.trim() : ''

  if (!search && !userId) return { error: 'Give me a name or email to look up (or a user id).' }

  const dirQuery: Record<string, string> = {}
  if (plan.directory.searchParam && search) dirQuery[plan.directory.searchParam] = search

  const dirJson = await getJson(plan.directory.path, dirQuery)
  if (isErrorPayload(dirJson)) return { error: `Could not open the directory: ${dirJson.error}` }

  let rows = rowsOf(dirJson, plan.directory.rowsKey)
  // Directories without a server-side search param (instructors) filter here,
  // token-by-token so word order and middle initials don't break a name match.
  if (!plan.directory.searchParam && search) {
    const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)
    rows = rows.filter((r) => rowMatchesTokens(r, tokens))
  }

  const match = userId ? rows.find((r) => rowId(r) === userId) : pickBest(rows, search)
  if (!match) return { error: `No matching person for "${search || userId}".` }

  const id = rowId(match)
  const name = rowName(match)

  const facets: Record<string, unknown> = {}
  for (const f of plan.facets) {
    if (f.path.includes('{id}') && !id) {
      facets[f.name] = { error: 'no id resolved for this person' }
      continue
    }
    const path = id ? f.path.replace('{id}', encodeURIComponent(id)) : f.path
    const query: Record<string, string> = {}
    if (f.query) {
      for (const [k, v] of Object.entries(f.query)) {
        query[k] = v.replace('{name}', name).replace('{search}', search)
      }
    }
    facets[f.name] = await getJson(path, query)
  }

  return { person: match, facets }
}
