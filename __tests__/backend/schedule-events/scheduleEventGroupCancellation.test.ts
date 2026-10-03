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
vi.mock('@/backend/admin/admin-audit.service', () => ({
  AdminAuditService: { log: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('@/backend/schedule-events/scheduleEventGroupHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/backend/schedule-events/scheduleEventGroupHelpers')>()
  return {
    ...actual,
    fetchUsersByRole: vi.fn().mockResolvedValue([{ email: 'ba@example.com', full_name: 'BA User' }]),
  }
})

import {
  requestOrExecuteCancellation,
  confirmCancellation,
  declineCancellation,
  deleteGroup,
} from '@/backend/schedule-events/scheduleEventGroupCancellation'
import { NotificationService } from '@/backend/notifications/notification.service'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { AdminAuditService } from '@/backend/admin/admin-audit.service'

const mockNotify = vi.mocked(NotificationService)
const mockEmail = vi.mocked(sendBrevoEmail)
const mockAuditLog = vi.mocked(AdminAuditService.log)

beforeEach(() => {
  vi.clearAllMocks()
  mockNotify.create.mockResolvedValue(undefined)
  mockNotify.createBulk.mockResolvedValue(undefined)
  mockNotify.createForRoles.mockResolvedValue(1)
})

function seedActiveGroup(overrides: Partial<any> = {}) {
  const dayOfWeek = new Date('2026-09-01').getDay()
  return {
    bookings: [
      {
        id: 'evt-1',
        group_id: 'grp-1',
        event_name: 'Exam Week',
        booking_date: '2026-09-01',
        start_time: '00:00',
        end_time: '23:59',
        current_status: 'auto_approved',
        booking_type: 'school_event_block',
        user_id: 'ah-user',
        event_requested_by_role: 'academic_head',
        ...overrides,
      },
    ],
    booking_facilities: [{ booking_id: 'evt-1', facility_id: 'fac-1' }],
    users: [{ id: 'ah-user', email: 'ah@example.com', full_name: 'AH User' }],
    class_schedules: [
      {
        id: 'cs-1',
        facility_id: 'fac-1',
        is_active: true,
        day_of_week: [dayOfWeek],
        start_time: '09:00',
        end_time: '10:00',
      },
    ],
    class_schedule_exceptions: [{ schedule_id: 'cs-1', exception_date: '2026-09-01' }],
  }
}

describe('requestOrExecuteCancellation', () => {
  it('building_admin: behaves like immediate cancel -- flips straight to cancelled, no new notification', async () => {
    const { client, tables } = makeFakeSupabase(seedActiveGroup())

    const result = await requestOrExecuteCancellation(client as any, 'grp-1', 'building_admin', 'ba-user', 'BA User')

    expect(result.ok).toBe(true)
    expect(tables.bookings[0].current_status).toBe('cancelled')
    expect(mockNotify.create).not.toHaveBeenCalled()
    expect(mockNotify.createForRoles).not.toHaveBeenCalled()
    expect(mockEmail).not.toHaveBeenCalled()
  })

  it('building_admin: logs to audit_logs on immediate cancel', async () => {
    const { client } = makeFakeSupabase(seedActiveGroup())

    await requestOrExecuteCancellation(client as any, 'grp-1', 'building_admin', 'ba-user', 'BA User')

    expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'ba-user',
      action: 'school_event_group_cancelled',
      targetType: 'special_event',
      targetId: 'grp-1',
    }))
  })

  it('academic_head: flips to cancellation_requested, block stays active, notifies building_admin', async () => {
    const { client, tables } = makeFakeSupabase(seedActiveGroup())

    const result = await requestOrExecuteCancellation(client as any, 'grp-1', 'academic_head', 'ah-user', 'AH User')

    expect(result.ok).toBe(true)
    expect(tables.bookings[0].current_status).toBe('cancellation_requested')
    expect(mockNotify.createForRoles).toHaveBeenCalledWith(['building_admin'], expect.any(Object))
    expect(mockEmail).toHaveBeenCalledTimes(1)
  })

  it('errors if the group is not currently auto_approved', async () => {
    const { client } = makeFakeSupabase(seedActiveGroup({ current_status: 'pending' }))

    const result = await requestOrExecuteCancellation(client as any, 'grp-1', 'academic_head', 'ah-user', 'AH User')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_STATUS')
  })
})

describe('confirmCancellation', () => {
  it('only valid on cancellation_requested: flips to cancelled, cleans up class_schedule_exceptions, notifies AH requester', async () => {
    const { client, tables } = makeFakeSupabase(seedActiveGroup({ current_status: 'cancellation_requested' }))

    const result = await confirmCancellation(client as any, 'grp-1', 'ba-user', 'BA User')

    expect(result.ok).toBe(true)
    expect(tables.bookings[0].current_status).toBe('cancelled')
    expect(tables.bookings[0].event_decided_by).toBe('ba-user')
    expect(tables.class_schedule_exceptions).toHaveLength(0)
    expect(mockNotify.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'ah-user' }))
    expect(mockEmail).toHaveBeenCalledTimes(1)
  })

  it('logs to audit_logs when BA confirms AH-requested cancellation', async () => {
    const { client } = makeFakeSupabase(seedActiveGroup({ current_status: 'cancellation_requested' }))

    await confirmCancellation(client as any, 'grp-1', 'ba-user', 'BA User')

    expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'ba-user',
      action: 'school_event_cancellation_confirmed',
      targetType: 'special_event',
      targetId: 'grp-1',
    }))
  })

  it('errors on a group that is not cancellation_requested', async () => {
    const { client } = makeFakeSupabase(seedActiveGroup({ current_status: 'auto_approved' }))

    const result = await confirmCancellation(client as any, 'grp-1', 'ba-user', 'BA User')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_STATUS')
  })
})

describe('declineCancellation', () => {
  it('only valid on cancellation_requested: reverts to auto_approved, notifies AH requester', async () => {
    const { client, tables } = makeFakeSupabase(seedActiveGroup({ current_status: 'cancellation_requested' }))

    const result = await declineCancellation(client as any, 'grp-1', 'ba-user', 'BA User')

    expect(result.ok).toBe(true)
    expect(tables.bookings[0].current_status).toBe('auto_approved')
    expect(mockNotify.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'ah-user' }))
    expect(mockEmail).toHaveBeenCalledTimes(1)
  })

  it('errors on a group that is not cancellation_requested', async () => {
    const { client } = makeFakeSupabase(seedActiveGroup({ current_status: 'auto_approved' }))

    const result = await declineCancellation(client as any, 'grp-1', 'ba-user', 'BA User')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('INVALID_STATUS')
  })
})

describe('deleteGroup (BA-immediate hard delete)', () => {
  it('removes every row in the group and the matching class_schedule_exceptions', async () => {
    const { client, tables } = makeFakeSupabase(seedActiveGroup())

    const result = await deleteGroup(client as any, 'grp-1')

    expect(result.ok).toBe(true)
    expect(tables.bookings.find((b) => b.group_id === 'grp-1')).toBeUndefined()
    expect(tables.class_schedule_exceptions).toHaveLength(0)
  })

  it('errors 404-shaped when the group does not exist', async () => {
    const { client } = makeFakeSupabase(seedActiveGroup())
    const result = await deleteGroup(client as any, 'nonexistent')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('NOT_FOUND')
  })
})
