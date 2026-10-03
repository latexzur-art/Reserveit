import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAcademicHeadUser, mockBuildingAdminUser } from '../../mocks/auth'
import { makeFakeSupabase as makeSharedFakeSupabase } from './testFakeSupabase'

/**
 * Phase 1 — characterization tests for TODAY's School Events behavior, written before any
 * refactor (per CLAUDE.md's TDD gate). These pin down the current single-facility/single-day
 * POST/PATCH/DELETE behavior, including two known bugs the plan intentionally fixes later:
 *   - the block_event_id bug (void helper called with no event_booking_id -> defaults to '')
 *   - the regression-guard case: PATCH approve is callable by EITHER academic_head or
 *     building_admin, and must stay that way (see spec §5's "guard-tightening mistake").
 *
 * Phase 3 rewrote POST to delegate to the new grouped/batched createGroup path (Phase 2) --
 * its two characterization tests below now run against the shared testFakeSupabase (which
 * supports bulk-array inserts and the extra facilities/users/user_roles tables that path
 * touches) instead of this file's original single-insert-only local fake, which the unchanged
 * PATCH/DELETE [id]/route.ts tests still use.
 */

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({
  requireAcademicHeadOrBuildingAdmin: vi.fn(),
}))

vi.mock('@/backend/schedule-events/voidSchoolEventConflicts', () => ({
  voidConflictsForSchoolEvent: vi.fn().mockResolvedValue({ bookingsVoided: 0, schedulesVoided: 0 }),
  timeToMinutes: (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  },
}))

import { POST } from '@/app/api/academic-head/schedule-events/route'
import { PATCH, DELETE } from '@/app/api/academic-head/schedule-events/[id]/route'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { voidConflictsForSchoolEvent } from '@/backend/schedule-events/voidSchoolEventConflicts'

const mockRequireAuth = vi.mocked(requireAcademicHeadOrBuildingAdmin)
const mockCreateAdmin = vi.mocked(createAdminClient)
const mockVoid = vi.mocked(voidConflictsForSchoolEvent)

/* ------------------------------------------------------------------ */
/*  Fake Supabase tailored to bookings/booking_facilities/            */
/*  class_schedules/class_schedule_exceptions query shapes used by    */
/*  the two School Events route files.                                */
/* ------------------------------------------------------------------ */

interface BookingRow {
  id: string
  event_name: string
  booking_date: string
  start_time: string
  end_time: string
  current_status: string
  booking_type: string
  [k: string]: any
}

function makeFakeSupabase(seed: {
  bookings?: BookingRow[]
  bookingFacilities?: { booking_id: string; facility_id: string }[]
  classSchedules?: any[]
  classScheduleExceptions?: { schedule_id: string; exception_date: string }[]
}) {
  const bookings: BookingRow[] = [...(seed.bookings ?? [])]
  const bookingFacilities = [...(seed.bookingFacilities ?? [])]
  const classSchedules = [...(seed.classSchedules ?? [])]
  const classScheduleExceptions = [...(seed.classScheduleExceptions ?? [])]
  let nextId = 1
  const genId = () => `booking-${nextId++}`

  function applyEqs(rows: any[], eqs: { col: string; val: any }[], neqs: { col: string; val: any }[], ins: { col: string; vals: any[] }[]) {
    let out = rows
    for (const e of eqs) out = out.filter((r) => r[e.col] === e.val)
    for (const e of neqs) out = out.filter((r) => r[e.col] !== e.val)
    for (const e of ins) out = out.filter((r) => e.vals.includes(r[e.col]))
    return out
  }

  function bookingsTable() {
    const state: any = { eqs: [], neqs: [], ins: [] }
    const builder: any = {
      select: () => builder,
      insert: (payload: any) => {
        const id = genId()
        const row: BookingRow = { id, current_status: 'auto_approved', ...payload }
        bookings.push(row)
        state.insertedId = id
        return builder
      },
      update: (payload: any) => {
        state.update = payload
        return builder
      },
      delete: () => {
        state.delete = true
        return builder
      },
      eq: (col: string, val: any) => {
        state.eqs.push({ col, val })
        return builder
      },
      neq: (col: string, val: any) => {
        state.neqs.push({ col, val })
        return builder
      },
      in: (col: string, vals: any[]) => {
        state.ins.push({ col, vals })
        return builder
      },
      order: () => builder,
      single: async () => {
        if (state.insertedId) {
          return { data: { id: state.insertedId }, error: null }
        }
        if (state.update) {
          const rows = applyEqs(bookings, state.eqs, state.neqs, state.ins)
          rows.forEach((r) => Object.assign(r, state.update))
          return { data: rows[0] ?? null, error: null }
        }
        const rows = applyEqs(bookings, state.eqs, state.neqs, state.ins)
        const row = rows[0]
        if (!row) return { data: null, error: { message: 'not found' } }
        const bf = bookingFacilities
          .filter((l) => l.booking_id === row.id)
          .map((l) => ({ facility_id: l.facility_id }))
        return { data: { ...row, booking_facilities: bf }, error: null }
      },
      then: (resolve: any) => {
        if (state.update) {
          const rows = applyEqs(bookings, state.eqs, state.neqs, state.ins)
          rows.forEach((r) => Object.assign(r, state.update))
          resolve({ data: rows, error: null })
          return
        }
        if (state.delete) {
          const rows = applyEqs(bookings, state.eqs, state.neqs, state.ins)
          for (const r of rows) {
            const idx = bookings.indexOf(r)
            if (idx !== -1) bookings.splice(idx, 1)
          }
          resolve({ data: null, error: null })
          return
        }
        resolve({ data: bookings, error: null })
      },
    }
    return builder
  }

  function bookingFacilitiesTable() {
    const state: any = { eqs: [] }
    const builder: any = {
      insert: (payload: any) => {
        bookingFacilities.push({ ...payload })
        return builder
      },
      select: () => builder,
      eq: (col: string, val: any) => {
        state.eqs.push({ col, val })
        return builder
      },
      then: (resolve: any) => {
        resolve({ data: bookingFacilities, error: null })
      },
    }
    return builder
  }

  function classSchedulesTable() {
    const state: any = { eqs: [], ins: [] }
    const builder: any = {
      select: () => builder,
      eq: (col: string, val: any) => {
        state.eqs.push({ col, val })
        return builder
      },
      in: (col: string, vals: any[]) => {
        state.ins.push({ col, vals })
        return builder
      },
      then: (resolve: any) => {
        const rows = applyEqs(classSchedules, state.eqs, [], state.ins)
        resolve({ data: rows, error: null })
      },
    }
    return builder
  }

  function classScheduleExceptionsTable() {
    const state: any = { eqs: [], ins: [], delete: false }
    const builder: any = {
      delete: () => {
        state.delete = true
        return builder
      },
      eq: (col: string, val: any) => {
        state.eqs.push({ col, val })
        return builder
      },
      in: (col: string, vals: any[]) => {
        state.ins.push({ col, vals })
        return builder
      },
      then: (resolve: any) => {
        if (state.delete) {
          const toRemove = applyEqs(classScheduleExceptions, state.eqs, [], state.ins)
          for (const r of toRemove) {
            const idx = classScheduleExceptions.indexOf(r)
            if (idx !== -1) classScheduleExceptions.splice(idx, 1)
          }
        }
        resolve({ data: null, error: null })
      },
    }
    return builder
  }

  const client = {
    from: (table: string) => {
      if (table === 'bookings') return bookingsTable()
      if (table === 'booking_facilities') return bookingFacilitiesTable()
      if (table === 'class_schedules') return classSchedulesTable()
      if (table === 'class_schedule_exceptions') return classScheduleExceptionsTable()
      // Everything else (user_roles, facilities, users, ...) is out of scope for these
      // route-level POST/PATCH/DELETE tests -- no-op empty result rather than throwing, so
      // createGroup's downstream notification fan-out (real, unmocked NotificationService
      // internals) doesn't crash a test that isn't exercising notifications.
      const empty: any = {
        select: () => empty,
        eq: () => empty,
        neq: () => empty,
        in: () => empty,
        order: () => empty,
        single: async () => ({ data: null, error: null }),
        then: (resolve: any) => resolve({ data: [], error: null }),
      }
      return empty
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }

  return {
    client,
    state: { bookings, bookingFacilities, classSchedules, classScheduleExceptions },
  }
}

function makePostRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/academic-head/schedule-events', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makePatchRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/academic-head/schedule-events/x', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const asBuildingAdmin = () =>
  mockRequireAuth.mockResolvedValue({ error: null, user: mockBuildingAdminUser as any })
const asAcademicHead = () =>
  mockRequireAuth.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })

beforeEach(() => {
  vi.clearAllMocks()
  mockVoid.mockResolvedValue({ bookingsVoided: 0, schedulesVoided: 0 })
})

describe('POST /api/academic-head/schedule-events (today\'s behavior)', () => {
  it('one facility, one date, as building_admin creates exactly 1 bookings row (auto_approved) + 1 booking_facilities row', async () => {
    asBuildingAdmin()
    const { client, tables } = makeSharedFakeSupabase({})
    mockCreateAdmin.mockReturnValue(client as any)

    const res = await POST(
      makePostRequest({
        event_name: 'Founders Day',
        start_date: '2026-09-01',
        end_date: '2026-09-01',
        start_time: '08:00',
        end_time: '17:00',
        facility_ids: ['fac-1'],
      })
    )

    expect(res.status).toBe(200)
    expect(tables.bookings).toHaveLength(1)
    expect(tables.bookings[0].current_status).toBe('auto_approved')
    expect(tables.booking_facilities).toHaveLength(1)
    expect(tables.booking_facilities[0]).toMatchObject({ booking_id: tables.bookings[0].id, facility_id: 'fac-1' })
  })

  it('one facility, a 3-day range, as building_admin creates exactly 3 bookings rows, all auto_approved', async () => {
    asBuildingAdmin()
    const { client, tables } = makeSharedFakeSupabase({})
    mockCreateAdmin.mockReturnValue(client as any)

    const res = await POST(
      makePostRequest({
        event_name: 'Founders Week',
        start_date: '2026-09-01',
        end_date: '2026-09-03',
        start_time: '08:00',
        end_time: '17:00',
        facility_ids: ['fac-1'],
      })
    )

    expect(res.status).toBe(200)
    expect(tables.bookings).toHaveLength(3)
    expect(tables.bookings.every((b) => b.current_status === 'auto_approved')).toBe(true)
  })
})

describe('PATCH .../[id] action=cancel (today\'s shallow-cancel behavior)', () => {
  it('flips only that row\'s current_status to cancelled, nothing else touched', async () => {
    asBuildingAdmin()
    const seedRow: BookingRow = {
      id: 'evt-1',
      event_name: 'Test Event',
      booking_date: '2026-09-01',
      start_time: '08:00',
      end_time: '17:00',
      current_status: 'auto_approved',
      booking_type: 'school_event_block',
    }
    const { client, state } = makeFakeSupabase({
      bookings: [seedRow],
      bookingFacilities: [{ booking_id: 'evt-1', facility_id: 'fac-1' }],
    })
    mockCreateAdmin.mockReturnValue(client as any)

    const res = await PATCH(makePatchRequest({ action: 'cancel' }), {
      params: Promise.resolve({ id: 'evt-1' }),
    })

    expect(res.status).toBe(200)
    expect(state.bookings[0].current_status).toBe('cancelled')
    // does not restore/touch class_schedule_exceptions -- no such call happens on cancel
    expect(state.classScheduleExceptions).toEqual([])
  })
})

describe('DELETE .../[id] (today\'s thorough-delete behavior)', () => {
  it('removes the row and the matching class_schedule_exceptions for that exact date+facility', async () => {
    asBuildingAdmin()
    const seedRow: BookingRow = {
      id: 'evt-2',
      event_name: 'Test Event',
      booking_date: '2026-09-01', // a Tuesday
      start_time: '08:00',
      end_time: '17:00',
      current_status: 'auto_approved',
      booking_type: 'school_event_block',
    }
    const dayOfWeek = new Date('2026-09-01').getDay()
    const { client, state } = makeFakeSupabase({
      bookings: [seedRow],
      bookingFacilities: [{ booking_id: 'evt-2', facility_id: 'fac-1' }],
      classSchedules: [
        {
          id: 'cs-1',
          facility_id: 'fac-1',
          is_active: true,
          day_of_week: [dayOfWeek],
          start_time: '09:00',
          end_time: '10:00',
        },
      ],
      classScheduleExceptions: [{ schedule_id: 'cs-1', exception_date: '2026-09-01' }],
    })
    mockCreateAdmin.mockReturnValue(client as any)

    const res = await DELETE(new NextRequest('http://localhost:3000/x', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'evt-2' }),
    })

    expect(res.status).toBe(200)
    expect(state.bookings).toHaveLength(0)
    expect(state.classScheduleExceptions).toHaveLength(0)
  })
})

describe('PATCH .../[id] action=approve (today\'s buggy void call + the guard regression check)', () => {
  const seedPending = (): BookingRow => ({
    id: 'evt-3',
    event_name: 'PH Submitted Event',
    booking_date: '2026-09-01',
    start_time: '08:00',
    end_time: '17:00',
    current_status: 'pending',
    booking_type: 'school_event_block',
  })

  it('Phase 2d fix: called by academic_head, passes event.id as event_booking_id (7th positional arg) to the void helper', async () => {
    asAcademicHead()
    const { client, state } = makeFakeSupabase({
      bookings: [seedPending()],
      bookingFacilities: [{ booking_id: 'evt-3', facility_id: 'fac-1' }],
    })
    mockCreateAdmin.mockReturnValue(client as any)

    const res = await PATCH(makePatchRequest({ action: 'approve' }), {
      params: Promise.resolve({ id: 'evt-3' }),
    })

    expect(res.status).toBe(200)
    expect(state.bookings[0].current_status).toBe('auto_approved')
    expect(mockVoid).toHaveBeenCalledTimes(1)
    const call = mockVoid.mock.calls[0]
    expect(call[6]).toBe('evt-3')
  })

  it('regression guard: called by building_admin also succeeds (must stay true after Phase 2)', async () => {
    asBuildingAdmin()
    const { client, state } = makeFakeSupabase({
      bookings: [seedPending()],
      bookingFacilities: [{ booking_id: 'evt-3', facility_id: 'fac-1' }],
    })
    mockCreateAdmin.mockReturnValue(client as any)

    const res = await PATCH(makePatchRequest({ action: 'approve' }), {
      params: Promise.resolve({ id: 'evt-3' }),
    })

    expect(res.status).toBe(200)
    expect(state.bookings[0].current_status).toBe('auto_approved')
  })
})
