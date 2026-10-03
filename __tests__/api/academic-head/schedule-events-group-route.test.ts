import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAcademicHeadUser, mockBuildingAdminUser } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => ({
  requireBuildingAdminStrict: vi.fn(),
  requireAcademicHeadOrBuildingAdmin: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({})),
}))
vi.mock('@/backend/schedule-events/scheduleEventGroupActions', () => ({
  approveGroup: vi.fn(),
  rejectGroup: vi.fn(),
  withdrawGroup: vi.fn(),
}))
vi.mock('@/backend/schedule-events/scheduleEventGroupCancellation', () => ({
  requestOrExecuteCancellation: vi.fn(),
  confirmCancellation: vi.fn(),
  declineCancellation: vi.fn(),
  deleteGroup: vi.fn(),
}))

import { PATCH, DELETE } from '@/app/api/academic-head/schedule-events/group/[groupId]/route'
import { requireBuildingAdminStrict, requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import {
  approveGroup,
  rejectGroup,
  withdrawGroup,
} from '@/backend/schedule-events/scheduleEventGroupActions'
import {
  requestOrExecuteCancellation,
  confirmCancellation,
  declineCancellation,
  deleteGroup,
} from '@/backend/schedule-events/scheduleEventGroupCancellation'

const mockBA = vi.mocked(requireBuildingAdminStrict)
const mockAHorBA = vi.mocked(requireAcademicHeadOrBuildingAdmin)
const mockApprove = vi.mocked(approveGroup)
const mockReject = vi.mocked(rejectGroup)
const mockWithdraw = vi.mocked(withdrawGroup)
const mockRequestCancel = vi.mocked(requestOrExecuteCancellation)
const mockConfirmCancel = vi.mocked(confirmCancellation)
const mockDeclineCancel = vi.mocked(declineCancellation)
const mockDeleteGroup = vi.mocked(deleteGroup)

function makePatchRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/academic-head/schedule-events/group/g1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}
const ctx = { params: Promise.resolve({ groupId: 'g1' }) }

const FORBIDDEN = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/academic-head/schedule-events/group/[groupId]', () => {
  it('403s when an academic_head session calls approve (BA-only)', async () => {
    mockBA.mockResolvedValue({ error: FORBIDDEN as any, user: null as any })
    const res = await PATCH(makePatchRequest({ action: 'approve' }), ctx)
    expect(res.status).toBe(403)
    expect(mockApprove).not.toHaveBeenCalled()
  })

  it('403s when an academic_head session calls reject (BA-only)', async () => {
    mockBA.mockResolvedValue({ error: FORBIDDEN as any, user: null as any })
    const res = await PATCH(makePatchRequest({ action: 'reject', reason: 'no' }), ctx)
    expect(res.status).toBe(403)
    expect(mockReject).not.toHaveBeenCalled()
  })

  it('403s when an academic_head session calls confirm_cancellation (BA-only)', async () => {
    mockBA.mockResolvedValue({ error: FORBIDDEN as any, user: null as any })
    const res = await PATCH(makePatchRequest({ action: 'confirm_cancellation' }), ctx)
    expect(res.status).toBe(403)
    expect(mockConfirmCancel).not.toHaveBeenCalled()
  })

  it('403s when an academic_head session calls decline_cancellation (BA-only)', async () => {
    mockBA.mockResolvedValue({ error: FORBIDDEN as any, user: null as any })
    const res = await PATCH(makePatchRequest({ action: 'decline_cancellation' }), ctx)
    expect(res.status).toBe(403)
    expect(mockDeclineCancel).not.toHaveBeenCalled()
  })

  it('200s and calls approveGroup when building_admin calls approve', async () => {
    mockBA.mockResolvedValue({ error: null, user: mockBuildingAdminUser as any })
    mockApprove.mockResolvedValue({ ok: true, data: { bookingsVoided: 1, schedulesVoided: 0 } })
    const res = await PATCH(makePatchRequest({ action: 'approve' }), ctx)
    expect(res.status).toBe(200)
    expect(mockApprove).toHaveBeenCalledWith(expect.anything(), 'g1', mockBuildingAdminUser.id, expect.any(String))
  })

  it('404s when the group does not exist', async () => {
    mockBA.mockResolvedValue({ error: null, user: mockBuildingAdminUser as any })
    mockApprove.mockResolvedValue({ ok: false, code: 'NOT_FOUND', message: 'Group not found' })
    const res = await PATCH(makePatchRequest({ action: 'approve' }), ctx)
    expect(res.status).toBe(404)
  })

  it('request_cancellation uses requireAcademicHeadOrBuildingAdmin and works for academic_head', async () => {
    mockAHorBA.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })
    mockRequestCancel.mockResolvedValue({ ok: true, data: { immediate: false } })
    const res = await PATCH(makePatchRequest({ action: 'request_cancellation' }), ctx)
    expect(res.status).toBe(200)
    expect(mockRequestCancel).toHaveBeenCalledWith(expect.anything(), 'g1', 'academic_head', mockAcademicHeadUser.id, expect.any(String))
  })

  it('withdraw uses requireAcademicHeadOrBuildingAdmin and works for the requester', async () => {
    mockAHorBA.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })
    mockWithdraw.mockResolvedValue({ ok: true, data: null })
    const res = await PATCH(makePatchRequest({ action: 'withdraw' }), ctx)
    expect(res.status).toBe(200)
    expect(mockWithdraw).toHaveBeenCalledWith(expect.anything(), 'g1', mockAcademicHeadUser.id)
  })

  it('400s on an unknown action', async () => {
    mockAHorBA.mockResolvedValue({ error: null, user: mockAcademicHeadUser as any })
    mockBA.mockResolvedValue({ error: null, user: mockBuildingAdminUser as any })
    const res = await PATCH(makePatchRequest({ action: 'bogus' }), ctx)
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/academic-head/schedule-events/group/[groupId]', () => {
  it('is BA-only (403 when guard rejects)', async () => {
    mockBA.mockResolvedValue({ error: FORBIDDEN as any, user: null as any })
    const req = new NextRequest('http://localhost:3000/x', { method: 'DELETE' })
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(403)
    expect(mockDeleteGroup).not.toHaveBeenCalled()
  })

  it('200s and calls deleteGroup for building_admin', async () => {
    mockBA.mockResolvedValue({ error: null, user: mockBuildingAdminUser as any })
    mockDeleteGroup.mockResolvedValue({ ok: true, data: null })
    const req = new NextRequest('http://localhost:3000/x', { method: 'DELETE' })
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(200)
    expect(mockDeleteGroup).toHaveBeenCalledWith(expect.anything(), 'g1')
  })

  it('404s when the group does not exist', async () => {
    mockBA.mockResolvedValue({ error: null, user: mockBuildingAdminUser as any })
    mockDeleteGroup.mockResolvedValue({ ok: false, code: 'NOT_FOUND', message: 'Group not found' })
    const req = new NextRequest('http://localhost:3000/x', { method: 'DELETE' })
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(404)
  })
})
