import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))

const PAYMENT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const RESOLVED_PAYMENT_ID = '9f8e7d6c-5b4a-4321-8765-1234567890ab'

const { mockConfirm, mockOverride, mockAuditLog, mockSupabase, mockSendNotificationToRoles } = vi.hoisted(() => {
  const mockConfirm = vi.fn().mockResolvedValue({ paymentId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', amount: 500 })
  const mockOverride = vi.fn().mockResolvedValue(undefined)
  const mockAuditLog = vi.fn().mockResolvedValue(undefined)
  const mockSendNotificationToRoles = vi.fn().mockResolvedValue(undefined)
  const mockSupabase: any = {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { user_id: 'u-1' }, error: null }) }) }),
    }),
  }
  return { mockConfirm, mockOverride, mockAuditLog, mockSupabase, mockSendNotificationToRoles }
})
vi.mock('@/backend/payments/manualRefundService', () => ({ ManualRefundService: { confirmEntitlement: mockConfirm, override: mockOverride } }))
vi.mock('@/backend/admin/admin-audit.service', () => ({ AdminAuditService: { log: mockAuditLog } }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))
vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn(),
  sendNotificationToRoles: mockSendNotificationToRoles,
}))
vi.mock('@/backend/notifications/recipientResolver', () => ({ resolveUserEmail: vi.fn().mockResolvedValue({ emailTo: null, name: null }) }))
vi.mock('@/backend/notifications/brevoEmailService', () => ({ sendBrevoEmail: vi.fn() }))

import { POST } from '@/app/api/admin/building/payments/[id]/refunds/route'

function defaultFrom() {
  return {
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { user_id: 'u-1' }, error: null }) }) }),
  }
}

describe('POST /api/admin/building/payments/[id]/refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from = defaultFrom
  })

  it('rejects an unknown trigger_type', async () => {
    const req = new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ trigger_type: 'magic' }) })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(400)
  })

  it('ba_override requires justification_note, destination_name, destination_contact_number', async () => {
    const req = new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ trigger_type: 'ba_override', amount: 500 }) })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(400)
  })

  it('ba_override logs to audit_logs on success', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({
        trigger_type: 'ba_override', amount: 500, justification_note: 'phone arrangement',
        destination_name: 'Jane', destination_contact_number: '0917',
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'payment_refund_override' }))
  })

  it('cancellation_request_entitlement requires cancellation_request_id', async () => {
    const req = new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ trigger_type: 'cancellation_request_entitlement' }) })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(400)
  })

  it('returns 409 when ManualRefundService reports already_refunded', async () => {
    mockOverride.mockRejectedValueOnce(new Error('already_refunded'))
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ trigger_type: 'ba_override', amount: 500, justification_note: 'x', destination_name: 'Jane', destination_contact_number: '0917' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(409)
  })

  it('notifies building admins to upload proof after refund creation', async () => {
    mockSupabase.from = (table: string) => {
      if (table === 'payment_refunds') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({
            data: { amount: 500, destination_name: 'Jane', booking: { booking_reference: 'BK-9001' } },
            error: null,
          }) }) }),
        }
      }
      return defaultFrom()
    }

    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({
        trigger_type: 'ba_override', amount: 500, justification_note: 'phone arrangement',
        destination_name: 'Jane', destination_contact_number: '0917',
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockSendNotificationToRoles).toHaveBeenCalledWith(
      expect.anything(),
      ['building_admin'],
      expect.objectContaining({ title: 'Refund Created — Upload Proof' }),
    )
  })

  it('cancellation_request_entitlement logs to audit_logs with the service-resolved payment id', async () => {
    mockConfirm.mockResolvedValueOnce({ paymentId: RESOLVED_PAYMENT_ID, amount: 500 })
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({
        trigger_type: 'cancellation_request_entitlement', cancellation_request_id: 'c1c1c1c1-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'payment_refund_entitlement_confirmed',
      targetType: 'payment',
      targetId: RESOLVED_PAYMENT_ID,
    }))
  })

  it('still returns success when the post-refund notification throws', async () => {
    mockSendNotificationToRoles.mockRejectedValueOnce(new Error('network blip'))
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({
        trigger_type: 'ba_override', amount: 500, justification_note: 'phone arrangement',
        destination_name: 'Jane', destination_contact_number: '0917',
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'payment_refund_override' }))
  })

  it('returns 400 when ManualRefundService reports the cancellation request is not approved', async () => {
    mockConfirm.mockRejectedValueOnce(new Error('cancellation_not_approved'))
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({
        trigger_type: 'cancellation_request_entitlement', cancellation_request_id: 'c1c1c1c1-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(400)
  })
})
