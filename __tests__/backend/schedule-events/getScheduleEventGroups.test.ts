import { describe, it, expect, beforeEach } from 'vitest'
import { makeFakeSupabase } from './testFakeSupabase'
import { getScheduleEventGroups } from '@/backend/schedule-events/getScheduleEventGroups'

function seedRows() {
  return {
    bookings: [
      // A 3-day, 1-facility grouped exam period (AH-created, pending)
      { id: 'b1', group_id: 'grp-exam', booking_type: 'school_event_block', event_name: 'Finals', booking_date: '2026-10-01', current_status: 'pending', block_category: 'exam_period', user_id: 'ah-1' },
      { id: 'b2', group_id: 'grp-exam', booking_type: 'school_event_block', event_name: 'Finals', booking_date: '2026-10-02', current_status: 'pending', block_category: 'exam_period', user_id: 'ah-1' },
      { id: 'b3', group_id: 'grp-exam', booking_type: 'school_event_block', event_name: 'Finals', booking_date: '2026-10-03', current_status: 'pending', block_category: 'exam_period', user_id: 'ah-1' },
      // A legacy PH-submitted ungrouped row (group_id null), auto_approved
      { id: 'b4', group_id: null, booking_type: 'school_event_block', event_name: 'PH Event', booking_date: '2026-11-01', current_status: 'auto_approved', block_category: 'school_event', user_id: 'ph-1' },
      // Another legacy ungrouped row, different date -- must NOT merge with b4 into one mega-group
      { id: 'b5', group_id: null, booking_type: 'school_event_block', event_name: 'PH Event 2', booking_date: '2026-11-05', current_status: 'auto_approved', block_category: 'school_event', user_id: 'ph-1' },
      // A non-school-event booking that must never leak into results
      { id: 'other-1', group_id: null, booking_type: 'reservation', event_name: null, booking_date: '2026-10-01', current_status: 'auto_approved', block_category: null, user_id: 'someone' },
    ],
    booking_facilities: [
      { booking_id: 'b1', facility_id: 'fac-1' },
      { booking_id: 'b2', facility_id: 'fac-1' },
      { booking_id: 'b3', facility_id: 'fac-1' },
      { booking_id: 'b4', facility_id: 'fac-2' },
      { booking_id: 'b5', facility_id: 'fac-2' },
    ],
    facilities: [
      { id: 'fac-1', name: 'Gym', room_number: 'G1', is_active: true },
      { id: 'fac-2', name: 'Room 101', room_number: '101', is_active: true },
    ],
    users: [
      { id: 'ah-1', full_name: 'Academic Head User', email: 'ah@example.com' },
      { id: 'ph-1', full_name: 'Program Head User', email: 'ph@example.com' },
    ],
  }
}

describe('getScheduleEventGroups', () => {
  it('collapses rows sharing a group_id into one entry with dates[]/facilities[]/booking_ids/created_by_name/current_status', async () => {
    const { client } = makeFakeSupabase(seedRows())
    const groups = await getScheduleEventGroups(client as any, {}, { publicView: false })

    const examGroup = groups.find((g) => g.group_id === 'grp-exam')!
    expect(examGroup).toBeTruthy()
    expect(examGroup.dates.sort()).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
    expect(examGroup.facilities.map((f) => f.id)).toEqual(['fac-1'])
    expect(examGroup.booking_ids?.sort()).toEqual(['b1', 'b2', 'b3'])
    expect(examGroup.created_by_name).toBe('Academic Head User')
    expect(examGroup.current_status).toBe('pending')
  })

  it('includes created_by_id (needed by the frontend to tell "my own pending request" from someone else\'s) when not publicView', async () => {
    const { client } = makeFakeSupabase(seedRows())
    const groups = await getScheduleEventGroups(client as any, {}, { publicView: false })
    const examGroup = groups.find((g) => g.group_id === 'grp-exam')!
    expect(examGroup.created_by_id).toBe('ah-1')
  })

  it('omits created_by_id in publicView, same as created_by_name', async () => {
    const { client } = makeFakeSupabase(seedRows())
    const groups = await getScheduleEventGroups(client as any, { status: 'pending' }, { publicView: true })
    expect(groups.every((g) => g.created_by_id === undefined)).toBe(true)
  })

  it('a group_id=NULL row is its own group of size 1 via COALESCE(group_id, id) -- not merged into one mega-group', async () => {
    const { client } = makeFakeSupabase(seedRows())
    const groups = await getScheduleEventGroups(client as any, {}, { publicView: false })

    const legacyGroups = groups.filter((g) => g.group_id === null)
    expect(legacyGroups).toHaveLength(2)
    const b4Group = legacyGroups.find((g) => g.booking_ids?.includes('b4'))!
    const b5Group = legacyGroups.find((g) => g.booking_ids?.includes('b5'))!
    expect(b4Group.booking_ids).toEqual(['b4'])
    expect(b5Group.booking_ids).toEqual(['b5'])
  })

  it('never includes non-school_event_block bookings', async () => {
    const { client } = makeFakeSupabase(seedRows())
    const groups = await getScheduleEventGroups(client as any, {}, { publicView: false })
    const allIds = groups.flatMap((g) => g.booking_ids ?? [])
    expect(allIds).not.toContain('other-1')
  })

  it('filters by status, block_category, facility_id, start_date/end_date independently and combined', async () => {
    const { client } = makeFakeSupabase(seedRows())

    const pendingOnly = await getScheduleEventGroups(client as any, { status: 'pending' }, { publicView: false })
    expect(pendingOnly).toHaveLength(1)
    expect(pendingOnly[0].group_id).toBe('grp-exam')

    const examOnly = await getScheduleEventGroups(client as any, { block_category: 'exam_period' }, { publicView: false })
    expect(examOnly).toHaveLength(1)

    const fac2Only = await getScheduleEventGroups(client as any, { facility_id: 'fac-2' }, { publicView: false })
    expect(fac2Only.map((g) => g.group_id).sort()).toEqual([null, null])

    const novRange = await getScheduleEventGroups(client as any, { start_date: '2026-11-01', end_date: '2026-11-03' }, { publicView: false })
    expect(novRange.flatMap((g) => g.booking_ids ?? [])).toEqual(['b4'])

    const combined = await getScheduleEventGroups(
      client as any,
      { block_category: 'exam_period', facility_id: 'fac-1', status: 'pending' },
      { publicView: false }
    )
    expect(combined).toHaveLength(1)
    expect(combined[0].group_id).toBe('grp-exam')
  })

  it('publicView strips booking_ids and created_by_name, and defaults to status=auto_approved when no explicit status filter given', async () => {
    const { client } = makeFakeSupabase(seedRows())
    const groups = await getScheduleEventGroups(client as any, {}, { publicView: true })

    expect(groups.every((g) => g.booking_ids === undefined)).toBe(true)
    expect(groups.every((g) => g.created_by_name === undefined)).toBe(true)
    // pending exam group must be excluded by the default auto_approved filter
    expect(groups.every((g) => g.current_status === 'auto_approved')).toBe(true)
    expect(groups.some((g) => g.group_id === 'grp-exam')).toBe(false)
  })

  it('an explicit status filter overrides the publicView default', async () => {
    const { client } = makeFakeSupabase(seedRows())
    const groups = await getScheduleEventGroups(client as any, { status: 'pending' }, { publicView: true })
    expect(groups).toHaveLength(1)
    expect(groups[0].group_id).toBe('grp-exam')
  })

  it('calls the auto_complete_past_bookings RPC exactly as before', async () => {
    const { client } = makeFakeSupabase(seedRows())
    let rpcCalled = false
    let rpcName = ''
    const origRpc = client.rpc
    client.rpc = async (name?: string, args?: any) => {
      rpcCalled = true
      rpcName = name ?? ''
      return origRpc(name, args)
    }
    await getScheduleEventGroups(client as any, {}, { publicView: false })
    expect(rpcCalled).toBe(true)
    expect(rpcName).toBe('auto_complete_past_bookings')
  })
})
