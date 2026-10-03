import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isActionAllowed,
  missingActionParams,
  describeAction,
  executeAction,
  getActionMeta,
  type ActionContext,
} from '@/backend/ai/actions'

const baseCtx = (roles: string[]): ActionContext => ({
  cookie: 'sb-token=abc',
  origin: 'http://localhost:3000',
  userId: 'user-1',
  roles,
})

describe('guarded action registry', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  describe('isActionAllowed', () => {
    it('honors allowedRoles per action', () => {
      expect(isActionAllowed('approve_booking', ['academic_head'])).toBe(true)
      expect(isActionAllowed('approve_booking', ['faculty'])).toBe(false)
      expect(isActionAllowed('set_user_status', ['it_admin'])).toBe(true)
      expect(isActionAllowed('set_user_status', ['building_admin'])).toBe(false)
      expect(isActionAllowed('cancel_my_booking', ['external_client'])).toBe(true)
    })
    it('rejects unknown actions', () => {
      expect(isActionAllowed('drop_database', ['it_admin'])).toBe(false)
    })
  })

  describe('missingActionParams', () => {
    it('reports missing required params', () => {
      expect(missingActionParams('approve_booking', { booking_id: 'b1' })).toEqual(['reason'])
      expect(missingActionParams('approve_booking', { booking_id: 'b1', reason: 'looks valid and complete' })).toEqual([])
      expect(missingActionParams('set_user_status', {})).toEqual(['user_id', 'status'])
    })
  })

  describe('describeAction', () => {
    it('produces a human summary', () => {
      expect(describeAction('set_user_status', { user_name: 'Jane', status: 'suspended' })).toContain('suspended')
      expect(describeAction('unknown', {})).toBeNull()
    })
  })

  describe('getActionMeta — risk tiers', () => {
    it('flags high-impact actions with a typed confirm phrase', () => {
      for (const t of ['set_active_term', 'reset_reliability', 'publish_schedule_upload', 'cancel_building_booking', 'lift_restriction']) {
        const meta = getActionMeta(t)
        expect(meta.risk, t).toBe('high')
        expect(meta.confirmPhrase, t).toBeTruthy()
      }
    })
    it('treats ordinary actions as normal (no phrase)', () => {
      for (const t of ['approve_booking', 'cancel_my_booking', 'assign_role', 'accept_alternative', 'restore_user']) {
        const meta = getActionMeta(t)
        expect(meta.risk, t).toBe('normal')
        expect(meta.confirmPhrase, t).toBeNull()
      }
    })
  })

  describe('executeAction — gate before any network call', () => {
    it('forbids a role that is not allowed (403, no fetch)', async () => {
      const res = await executeAction('set_user_status', { user_id: 'u9', status: 'active' }, baseCtx(['faculty']))
      expect(res.ok).toBe(false)
      expect(res.status).toBe(403)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects missing required params (400, no fetch)', async () => {
      const res = await executeAction('approve_booking', { booking_id: 'b1' }, baseCtx(['academic_head']))
      expect(res.ok).toBe(false)
      expect(res.status).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects unknown actions (400, no fetch)', async () => {
      const res = await executeAction('nuke', {}, baseCtx(['it_admin']))
      expect(res.ok).toBe(false)
      expect(res.status).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('forbids the expanded actions for the wrong role (403, no fetch)', async () => {
      const cases: Array<[string, Record<string, unknown>, string[]]> = [
        ['assign_role', { user_id: 'u1', role_id: 'r1' }, ['faculty']],
        ['publish_schedule_upload', { upload_id: 'up1' }, ['building_admin']],
        ['reject_paid_booking', { booking_id: 'b1' }, ['academic_head']],
        ['lift_restriction', { user_id: 'u1' }, ['building_admin']],
        ['reset_reliability', { user_id: 'u1' }, ['faculty']],
      ]
      for (const [type, params, roles] of cases) {
        const res = await executeAction(type, params, baseCtx(roles))
        expect(res.ok, type).toBe(false)
        expect(res.status, type).toBe(403)
      }
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('allows the expanded actions for the right role', () => {
      expect(isActionAllowed('assign_role', ['it_admin'])).toBe(true)
      expect(isActionAllowed('remove_role', ['it_admin'])).toBe(true)
      expect(isActionAllowed('publish_schedule_upload', ['academic_head'])).toBe(true)
      expect(isActionAllowed('cancel_building_booking', ['building_admin'])).toBe(true)
      expect(isActionAllowed('accept_alternative', ['faculty'])).toBe(true)
      expect(isActionAllowed('end_probation', ['it_admin'])).toBe(true)
    })

    it('builds the assign_role request correctly when allowed + complete', async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ success: true, message: 'Role assigned.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      const res = await executeAction('assign_role', { user_id: 'u1', role_id: 'r9' }, baseCtx(['it_admin']))
      expect(res.ok).toBe(true)
      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toBe('http://localhost:3000/api/admin/users/u1/role')
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body)).toMatchObject({ roleId: 'r9' })
    })

    it('proxies to the correct endpoint when allowed + complete', async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ message: 'Booking approved.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      const res = await executeAction(
        'approve_booking',
        { booking_id: 'b1', reason: 'Meets all requirements for approval.' },
        baseCtx(['academic_head'])
      )
      expect(res.ok).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toBe('http://localhost:3000/api/academic-head/review-booking')
      expect(init.method).toBe('POST')
      expect(init.headers.cookie).toBe('sb-token=abc')
      const body = JSON.parse(init.body)
      expect(body).toMatchObject({ booking_id: 'b1', action: 'approve' })
    })
  })
})
