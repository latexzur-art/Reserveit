/**
 * Shared bespoke fake Supabase client for Phase 2's School Events backend tests.
 * Generic enough to serve both `createScheduleEventGroup`'s own queries and the REAL
 * (unmocked) `applySchoolEventBlock` internals, for the tests that need to prove the
 * block_event_id fix has a real, observable DB effect rather than just asserting call args.
 *
 * Supports the exact flat select/insert/update/delete/in/eq/neq/gte/lte/single/maybeSingle
 * shapes used by these modules -- no nested-join selects, since none of the code under test
 * (new or existing) relies on one.
 */

interface FilterState {
  eqs: { c: string; v: any }[]
  neqs: { c: string; v: any }[]
  ins: { c: string; vals: any[] }[]
  gte: { c: string; v: any }[]
  lte: { c: string; v: any }[]
}

function filterRows(store: any[], state: FilterState) {
  let rows = store
  for (const e of state.eqs) rows = rows.filter((r) => r[e.c] === e.v)
  for (const e of state.neqs) rows = rows.filter((r) => r[e.c] !== e.v)
  for (const e of state.ins) rows = rows.filter((r) => e.vals.includes(r[e.c]))
  for (const e of state.gte) rows = rows.filter((r) => r[e.c] >= e.v)
  for (const e of state.lte) rows = rows.filter((r) => r[e.c] <= e.v)
  return rows
}

export interface FakeTables {
  bookings: any[]
  booking_facilities: any[]
  facilities: any[]
  users: any[]
  user_roles: any[]
  class_schedules: any[]
  class_schedule_exceptions: any[]
  class_schedule_reschedule_offers: any[]
}

export function makeFakeSupabase(seed: Partial<FakeTables> = {}) {
  const tables: FakeTables = {
    bookings: [...(seed.bookings ?? [])],
    booking_facilities: [...(seed.booking_facilities ?? [])],
    facilities: [...(seed.facilities ?? [])],
    users: [...(seed.users ?? [])],
    user_roles: [...(seed.user_roles ?? [])],
    class_schedules: [...(seed.class_schedules ?? [])],
    class_schedule_exceptions: [...(seed.class_schedule_exceptions ?? [])],
    class_schedule_reschedule_offers: [...(seed.class_schedule_reschedule_offers ?? [])],
  }

  const counters: Record<string, number> = {}
  function genId(table: string) {
    counters[table] = (counters[table] ?? 0) + 1
    return `${table}-${counters[table]}`
  }

  function makeTable(name: keyof FakeTables) {
    const store = tables[name]
    const state: FilterState = { eqs: [], neqs: [], ins: [], gte: [], lte: [] }
    let insertedRows: any[] | null = null
    let isUpdate = false
    let updatePayload: any = null
    let isDelete = false

    const builder: any = {
      select: () => builder,
      insert: (payload: any) => {
        const arr = Array.isArray(payload) ? payload : [payload]
        insertedRows = arr.map((p) => ({ id: p.id ?? genId(name), ...p }))
        store.push(...insertedRows)
        return builder
      },
      update: (payload: any) => {
        isUpdate = true
        updatePayload = payload
        return builder
      },
      delete: () => {
        isDelete = true
        return builder
      },
      eq: (c: string, v: any) => {
        state.eqs.push({ c, v })
        return builder
      },
      neq: (c: string, v: any) => {
        state.neqs.push({ c, v })
        return builder
      },
      in: (c: string, vals: any[]) => {
        state.ins.push({ c, vals })
        return builder
      },
      gte: (c: string, v: any) => {
        state.gte.push({ c, v })
        return builder
      },
      lte: (c: string, v: any) => {
        state.lte.push({ c, v })
        return builder
      },
      order: () => builder,
      limit: () => builder,
      single: async () => {
        if (insertedRows) return { data: insertedRows[0], error: null }
        if (isUpdate) {
          const rows = filterRows(store, state)
          rows.forEach((r) => Object.assign(r, updatePayload))
          return { data: rows[0] ?? null, error: null }
        }
        const rows = filterRows(store, state)
        return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: 'not found' } }
      },
      maybeSingle: async () => {
        const rows = filterRows(store, state)
        return { data: rows[0] ?? null, error: null }
      },
      then: (resolve: any) => {
        if (insertedRows) {
          resolve({ data: insertedRows, error: null })
          return
        }
        if (isUpdate) {
          const rows = filterRows(store, state)
          rows.forEach((r) => Object.assign(r, updatePayload))
          resolve({ data: rows, error: null })
          return
        }
        if (isDelete) {
          const rows = filterRows(store, state)
          for (const r of rows) {
            const idx = store.indexOf(r)
            if (idx !== -1) store.splice(idx, 1)
          }
          resolve({ data: null, error: null })
          return
        }
        resolve({ data: filterRows(store, state), error: null })
      },
    }
    return builder
  }

  const client = {
    from: (name: string) => {
      if (!(name in tables)) throw new Error(`unmocked table: ${name}`)
      return makeTable(name as keyof FakeTables)
    },
    rpc: async (_name?: string, _args?: any) => ({ data: null, error: null }),
  }

  return { client, tables }
}
