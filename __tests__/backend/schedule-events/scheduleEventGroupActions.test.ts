import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeFakeSupabase } from './testFakeSupabase'

vi.mock('@/backend/notifications/notification.service', () => ({
  NotificationService: {
    create: vi.fn().mockResolvedValue(undefined),
    createBulk: vi.fn().mockResolvedValue(undefined),
    createForRoles: vi.fn().mockResolvedValue(1),
  },
}))
vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/backend/schedule-events/scheduleEventGroupHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/backend/schedule-events/scheduleEventGroupHelpers')>()
  return {
    ...actual,
    fetchUsersByRole: vi.fn().mockResolvedValue([{ email: 'reviewer@example.com', full_name: 'Reviewer' }]),
  }
})
vi.mock('@/backend/schedule-events/applySchoolEventBlock', () => ({
  applySchoolEventBlock: vi.fn().mockResolvedValue({ bookingsAffected: 0, schedulesAffected: 0 }),
}))

import { createGroup, approveGroup, rejectGroup, withdrawGroup } from '@/backend/schedule-events/scheduleEventGroupActions'
import { NotificationService } from '@/backend/notifications/notification.service'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { applySchoolEventBlock } from '@/backend/schedule-events/applySchoolEventBlock'

const mockNotify = vi.mocked(NotificationService)
const mockEmail = vi.mocked(sendBrevoEmail)
const mockApplyBlock = vi.mocked(applySchoolEventBlock)

beforeEach(() => {
  vi.clearAllMocks()
  mockNotify.create.mockResolvedValue(undefined)
  mockNotify.createBulk.mockResolvedValue(undefined)
  mockNotify.createForRoles.mockResolvedValue(1)
  mockApplyBlock.mockResolvedValue({ bookingsAffected: 0, schedulesAffected: 0 })
})

const baseParams = {
  mode: 'school_event' as const,
  event_name: 'Founders Day',
  facility_ids: ['fac-1'],
  dates: ['2026-09-01'],
  start_time: '08:00',
  end_time: '17:00',
  userId: 'user-1',
}

describe('createGroup', () => {
  it('as building_admin: event_requires_approval false, requested_by_role building_admin, auto_approved; runs applySchoolEventBlock; FYI-notifies academic_head', async () => {
    const { client, tables } = makeFakeSupabase()

    await createGroup(client as any, { ...baseParams, actorRole: 'building_admin' }, 'BA User')

    expect(tables.bookings.every((b) => b.event_requires_approval === false)).toBe(true)
    expect(tables.bookings.every((b) => b.event_requested_by_role === 'building_admin')).toBe(true)
    expect(tables.bookings.every((b) => b.current_status === 'auto_approved')).toBe(true)
    expect(mockApplyBlock).toHaveBeenCalledTimes(1)
    expect(mockNotify.createForRoles).toHaveBeenCalledWith(['academic_head'], expect.any(Object))
    expect(mockEmail).toHaveBeenCalledTimes(1)
  })

  it('as academic_head: event_requires_approval true, event_approval_status pending, requested_by_role academic_head, pending; does not call applySchoolEventBlock; review-request-notifies building_admin', async () => {
    const { client, tables } = makeFakeSupabase()

    await createGroup(client as any, { ...baseParams, actorRole: 'academic_head' }, 'AH User')

    expect(tables.bookings.every((b) => b.event_requires_approval === true)).toBe(true)
    expect(tables.bookings.every((b) => b.event_approval_status === 'pending')).toBe(true)
    expect(tables.bookings.every((b) => b.event_requested_by_role === 'academic_head')).toBe(true)
    expect(tables.bookings.every((b) => b.current_status === 'pending')).toBe(true)
    expect(mockApplyBlock).not.toHaveBeenCalled()
    expect(mockNotify.createForRoles).toHaveBeenCalledWith(['building_admin'], expect.any(Object))
    expect(mockEmail).toHaveBeenCalledTimes(1)
  })
})

function seedPendingGroup(overrides: Partial<any> = {}) {
  return {
    bookings: [
      {
        id: 'evt-1',
        group_id: 'grp-1',
        event_name: 'Exam Week',
        booking_date: '2026-09-01',
        start_time: '00:00',
        end_time: '23:59',
        current_status: 'pending',
        booking_type: 'school_event_block',
        user_id: 'ah-user',
        event_requested_by_role: 'academic_head',
        ...overrides,
      },
    ],
    booking_facilities: [{ booking_id: 'evt-1', facility_id: 'fac-1' }],
    users: [{ id: 'ah-user', email: 'ah@example.com', full_name: 'AH User' }],
  }
}

describe('approveGroup', () => {
  it('flips pending group to auto_approved, sets approval decision fields, runs applySchoolEventBlock now, notifies requester', async () => {
    const { client, tables } = makeFakeSupabase(seedPendingGroup())

    const result = await approveGroup(client as any, 'grp-1', 'ba-user', 'BA User')

    expect(result.ok).toBe(true)
    expect(tables.bookings[0].current_status).toBe('auto_approved')
    expect(tables.bookings[0].event_approval_status).toBe('approved')
    expect(tables.bookings[0].event_decided_by).toBe('ba-user')
    expect(tables.bookings[0].event_decided_at).toBeTruthy()
    expect(mockApplyBlock).toHaveBeenCalledTimes(1)
    expect(mockNotify.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'ah-user' }))
    expect(mockEmail).toHaveBeenCalledTimes(1)
  })

  it('is a no-op error on an already-auto_approved group — does not double-run void or double-notify', async () => {
    const { client, tables } = makeFakeSupabase(seedPendingGroup({ current_status: 'auto_approved' }))

    const result = await approveGroup(client as any, 'grp-1', 'ba-user', 'BA User')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_STATUS')
    expect(mockApplyBlock).not.toHaveBeenCalled()
    expect(mockNotify.create).not.toHaveBeenCalled()
  })

  it('is a no-op error on a cancelled group', async () => {
    const { client } = makeFakeSupabase(seedPendingGroup({ current_status: 'cancelled' }))

    const result = await approveGroup(client as any, 'grp-1', 'ba-user', 'BA User')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_STATUS')
  })
})

describe('rejectGroup', () => {
  it('requires a non-empty reason', async () => {
    const { client } = makeFakeSupabase(seedPendingGroup())
    const result = await rejectGroup(client as any, 'grp-1', 'ba-user', 'BA User', '')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('VALIDATION')
    expect(mockApplyBlock).not.toHaveBeenCalled()
  })

  it('flips pending group to cancelled, sets declined + decision fields, never runs void, notifies requester', async () => {
    const { client, tables } = makeFakeSupabase(seedPendingGroup())

    const result = await rejectGroup(client as any, 'grp-1', 'ba-user', 'BA User', 'Not enough notice')

    expect(result.ok).toBe(true)
    expect(tables.bookings[0].current_status).toBe('cancelled')
    expect(tables.bookings[0].event_approval_status).toBe('declined')
    expect(tables.bookings[0].event_decided_by).toBe('ba-user')
    expect(tables.bookings[0].event_decision_notes).toBe('Not enough notice')
    expect(mockApplyBlock).not.toHaveBeenCalled()
    expect(mockNotify.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'ah-user' }))
    expect(mockEmail).toHaveBeenCalledTimes(1)
  })

  it('errors on a non-pending group', async () => {
    const { client } = makeFakeSupabase(seedPendingGroup({ current_status: 'auto_approved' }))
    const result = await rejectGroup(client as any, 'grp-1', 'ba-user', 'BA User', 'reason')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_STATUS')
  })
})

describe('withdrawGroup', () => {
  it('succeeds when the requester withdraws their own still-pending group', async () => {
    const { client, tables } = makeFakeSupabase(seedPendingGroup())

    const result = await withdrawGroup(client as any, 'grp-1', 'ah-user')

    expect(result.ok).toBe(true)
    expect(tables.bookings[0].current_status).toBe('cancelled')
    expect(mockNotify.createForRoles).toHaveBeenCalledWith(['building_admin'], expect.any(Object))
    // in-app only -- no email for a low-stakes withdrawal notice
    expect(mockEmail).not.toHaveBeenCalled()
  })

  it('errors 403-shaped when someone other than the requester tries to withdraw', async () => {
    const { client } = makeFakeSupabase(seedPendingGroup())

    const result = await withdrawGroup(client as any, 'grp-1', 'someone-else')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FORBIDDEN')
  })

  it('errors 400-shaped when the group is no longer pending', async () => {
    const { client } = makeFakeSupabase(seedPendingGroup({ current_status: 'auto_approved' }))

    const result = await withdrawGroup(client as any, 'grp-1', 'ah-user')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_STATUS')
  })
})
