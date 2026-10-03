import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeFakeSupabase } from './testFakeSupabase'

vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue(undefined),
}))

import { createScheduleEventGroup } from '@/backend/schedule-events/createScheduleEventGroup'
import * as applyBlockModule from '@/backend/schedule-events/applySchoolEventBlock'

const baseParams = {
  mode: 'school_event' as const,
  event_name: 'Founders Day',
  facility_ids: ['fac-1'],
  dates: ['2026-09-01'],
  start_time: '08:00',
  end_time: '17:00',
  userId: 'user-1',
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('createScheduleEventGroup — grouping + batching', () => {
  it('generates one group_id shared by every row created across all dates', async () => {
    const applySpy = vi.spyOn(applyBlockModule, 'applySchoolEventBlock').mockResolvedValue({ bookingsAffected: 0, schedulesAffected: 0 })
    const { client, tables } = makeFakeSupabase()

    await createScheduleEventGroup(client as any, {
      ...baseParams,
      dates: ['2026-09-01', '2026-09-02', '2026-09-03'],
      actorRole: 'building_admin',
    })

    expect(tables.bookings).toHaveLength(3)
    const groupIds = new Set(tables.bookings.map((b) => b.group_id))
    expect(groupIds.size).toBe(1)
    expect([...groupIds][0]).toBeTruthy()
    applySpy.mockRestore()
  })

  it('all_facilities: true resolves to every currently-active facility id via a fresh query, not a caller-suppliable list', async () => {
    const applySpy = vi.spyOn(applyBlockModule, 'applySchoolEventBlock').mockResolvedValue({ bookingsAffected: 0, schedulesAffected: 0 })
    const { client, tables } = makeFakeSupabase({
      facilities: [
        { id: 'fac-1', is_active: true },
        { id: 'fac-2', is_active: true },
        { id: 'fac-3', is_active: true },
        { id: 'fac-4', is_active: false },
      ],
    })

    const result = await createScheduleEventGroup(client as any, {
      ...baseParams,
      facility_ids: undefined,
      all_facilities: true,
      actorRole: 'building_admin',
    })

    const usedFacilityIds = new Set(tables.booking_facilities.map((bf) => bf.facility_id))
    expect(usedFacilityIds).toEqual(new Set(['fac-1', 'fac-2', 'fac-3']))
    expect(result.eventsCount).toBe(3)
    applySpy.mockRestore()
  })

  it('bulk-inserts all facility rows for a date in one call, not one per facility', async () => {
    const applySpy = vi.spyOn(applyBlockModule, 'applySchoolEventBlock').mockResolvedValue({ bookingsAffected: 0, schedulesAffected: 0 })
    const { client, tables } = makeFakeSupabase()
    const insertSpy = vi.fn()
    const realFrom = client.from.bind(client)
    client.from = (name: string) => {
      const builder = realFrom(name)
      if (name === 'bookings') {
        const origInsert = builder.insert.bind(builder)
        builder.insert = (payload: any) => {
          insertSpy(payload)
          return origInsert(payload)
        }
      }
      return builder
    }

    await createScheduleEventGroup(client as any, {
      ...baseParams,
      facility_ids: ['fac-1', 'fac-2', 'fac-3'],
      dates: ['2026-09-01'],
      actorRole: 'building_admin',
    })

    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(Array.isArray(insertSpy.mock.calls[0][0])).toBe(true)
    expect(insertSpy.mock.calls[0][0]).toHaveLength(3)
    expect(tables.bookings).toHaveLength(3)
    applySpy.mockRestore()
  })

  it('bulk-inserts the matching booking_facilities rows in one call per date', async () => {
    const applySpy = vi.spyOn(applyBlockModule, 'applySchoolEventBlock').mockResolvedValue({ bookingsAffected: 0, schedulesAffected: 0 })
    const { client, tables } = makeFakeSupabase()
    const insertSpy = vi.fn()
    const realFrom = client.from.bind(client)
    client.from = (name: string) => {
      const builder = realFrom(name)
      if (name === 'booking_facilities') {
        const origInsert = builder.insert.bind(builder)
        builder.insert = (payload: any) => {
          insertSpy(payload)
          return origInsert(payload)
        }
      }
      return builder
    }

    await createScheduleEventGroup(client as any, {
      ...baseParams,
      facility_ids: ['fac-1', 'fac-2'],
      dates: ['2026-09-01', '2026-09-02'],
      actorRole: 'building_admin',
    })

    expect(insertSpy).toHaveBeenCalledTimes(2) // once per date
    expect(tables.booking_facilities).toHaveLength(4) // 2 facilities x 2 dates
    applySpy.mockRestore()
  })

  it('every row created gets block_category set to the passed mode', async () => {
    const applySpy = vi.spyOn(applyBlockModule, 'applySchoolEventBlock').mockResolvedValue({ bookingsAffected: 0, schedulesAffected: 0 })
    const { client, tables } = makeFakeSupabase()

    await createScheduleEventGroup(client as any, {
      ...baseParams,
      mode: 'exam_period',
      dates: ['2026-09-01', '2026-09-02'],
      actorRole: 'building_admin',
    })

    expect(tables.bookings.every((b) => b.block_category === 'exam_period')).toBe(true)
    applySpy.mockRestore()
  })
})

describe('createScheduleEventGroup — actor-role status branching', () => {
  it('actorRole=building_admin: every row auto_approved, applySchoolEventBlock called for each date', async () => {
    const applySpy = vi.spyOn(applyBlockModule, 'applySchoolEventBlock').mockResolvedValue({ bookingsAffected: 0, schedulesAffected: 0 })
    const { client, tables } = makeFakeSupabase()

    await createScheduleEventGroup(client as any, {
      ...baseParams,
      dates: ['2026-09-01', '2026-09-02'],
      actorRole: 'building_admin',
    })

    expect(tables.bookings.every((b) => b.current_status === 'auto_approved')).toBe(true)
    expect(applySpy).toHaveBeenCalledTimes(2)
    applySpy.mockRestore()
  })

  it('actorRole=academic_head: every row pending, applySchoolEventBlock is never called', async () => {
    const applySpy = vi.spyOn(applyBlockModule, 'applySchoolEventBlock').mockResolvedValue({ bookingsAffected: 0, schedulesAffected: 0 })
    const { client, tables } = makeFakeSupabase()

    await createScheduleEventGroup(client as any, {
      ...baseParams,
      dates: ['2026-09-01', '2026-09-02'],
      actorRole: 'academic_head',
    })

    expect(tables.bookings.every((b) => b.current_status === 'pending')).toBe(true)
    expect(applySpy).not.toHaveBeenCalled()
    applySpy.mockRestore()
  })
})

describe('createScheduleEventGroup — the block_event_id bug fix', () => {
  it('calls applySchoolEventBlock directly (not the deprecated wrapper), passing the first row created for that date as event_booking_id', async () => {
    const applySpy = vi.spyOn(applyBlockModule, 'applySchoolEventBlock').mockResolvedValue({ bookingsAffected: 0, schedulesAffected: 0 })
    const { client, tables } = makeFakeSupabase()

    await createScheduleEventGroup(client as any, {
      ...baseParams,
      facility_ids: ['fac-1', 'fac-2'],
      dates: ['2026-09-01'],
      actorRole: 'building_admin',
    })

    expect(applySpy).toHaveBeenCalledTimes(1)
    const [, , , , , , eventBookingIdArg] = applySpy.mock.calls[0]
    const firstRowForDate = tables.bookings[0]
    expect(eventBookingIdArg).toBe(firstRowForDate.id)
    expect(eventBookingIdArg).not.toBe('')
    applySpy.mockRestore()
  })

  it('with the real id wired through, a displaced conflicting booking flips to awaiting_reschedule with a real block_event_id', async () => {
    // Uses the REAL applySchoolEventBlock (not mocked) to prove the fix has an observable DB effect.
    const { client, tables } = makeFakeSupabase({
      bookings: [
        {
          id: 'conflict-1',
          user_id: 'user-conflict',
          booking_reference: 'REF-1',
          booking_date: '2026-09-01',
          start_time: '09:00',
          end_time: '10:00',
          event_name: null,
          purpose: 'Faculty meeting',
          booking_purpose: 'general',
          current_status: 'approved',
        },
      ],
      booking_facilities: [{ booking_id: 'conflict-1', facility_id: 'fac-1' }],
      users: [{ id: 'user-conflict', email: 'conflict@example.com', full_name: 'Conflict User' }],
      facilities: [{ id: 'fac-1', name: 'Room 101', is_active: true }],
    })

    await createScheduleEventGroup(client as any, {
      ...baseParams,
      facility_ids: ['fac-1'],
      dates: ['2026-09-01'],
      actorRole: 'building_admin',
    })

    const displaced = tables.bookings.find((b) => b.id === 'conflict-1')
    expect(displaced.current_status).toBe('awaiting_reschedule')
    expect(displaced.block_event_id).toBeTruthy()
    expect(displaced.block_event_id).not.toBe('')
    // must be the real school-event-block row id, not the conflicting booking's own id
    expect(tables.bookings.some((b) => b.id === displaced.block_event_id && b.booking_type === 'school_event_block')).toBe(true)
  })

  it('with the real id wired through, class_schedule_reschedule_offers rows actually get created', async () => {
    const { client, tables } = makeFakeSupabase({
      class_schedules: [
        {
          id: 'cs-1',
          facility_id: 'fac-1',
          is_active: true,
          effective_start_date: '2026-01-01',
          effective_end_date: '2026-12-31',
          day_of_week: [new Date('2026-09-01T00:00:00').getDay()],
          start_time: '09:00',
          end_time: '10:00',
          instructor_id: 'instr-1',
          course_code: 'COSC1',
          section: 'A',
        },
      ],
      facilities: [{ id: 'fac-1', name: 'Room 101', is_active: true }],
      users: [{ id: 'instr-1', email: 'instr@example.com', full_name: 'Instructor' }],
    })

    await createScheduleEventGroup(client as any, {
      ...baseParams,
      facility_ids: ['fac-1'],
      dates: ['2026-09-01'],
      actorRole: 'building_admin',
    })

    expect(tables.class_schedule_reschedule_offers).toHaveLength(1)
    const offer = tables.class_schedule_reschedule_offers[0]
    expect(offer.block_event_id).toBeTruthy()
    expect(offer.block_event_id).not.toBe('')
    expect(tables.bookings.some((b) => b.id === offer.block_event_id && b.booking_type === 'school_event_block')).toBe(true)
  })
})
