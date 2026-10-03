import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))

const PAYMENT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

// mockSendNotification/mockSupabase must be created inside vi.hoisted() — vi.mock
// factories are hoisted above regular const declarations, so referencing plain
// top-level consts inside the factories below would TDZ-crash.
const { mockSendNotification, mockSupabase, mockResolveUserEmail, mockSendBrevoEmail } = vi.hoisted(() => {
  const mockSendNotification = vi.fn().mockResolvedValue(undefined)
  const mockResolveUserEmail = vi.fn().mockResolvedValue({ emailTo: null, name: null })
  const mockSendBrevoEmail = vi.fn().mockResolvedValue(undefined)
  const mockSupabase: any = {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', payment_status: 'pending_review', user_id: 'u-1' }, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }
  return { mockSendNotification, mockSupabase, mockResolveUserEmail, mockSendBrevoEmail }
})
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))
vi.mock('@/backend/booking/autoDecisionRouter', () => ({ sendNotification: mockSendNotification }))
vi.mock('@/backend/notifications/recipientResolver', () => ({ resolveUserEmail: mockResolveUserEmail }))
vi.mock('@/backend/notifications/brevoEmailService', () => ({ sendBrevoEmail: mockSendBrevoEmail }))

import { POST } from '@/app/api/admin/building/payments/[id]/qr-reject/route'

function defaultFrom() {
  return {
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: PAYMENT_ID, payment_status: 'pending_review', user_id: 'u-1' }, error: null }) }) }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
  }
}

describe('POST /api/admin/building/payments/[id]/qr-reject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendNotification.mockResolvedValue(undefined)
    mockResolveUserEmail.mockResolvedValue({ emailTo: null, name: null })
    // Reset mockSupabase.from to the pending_review default before each test —
    // vi.clearAllMocks() does not undo a plain property reassignment (it only
    // clears vi.fn() call state), so a test that overrides `.from` would leak.
    mockSupabase.from = defaultFrom
  })

  it('requires a reason', async () => {
    const req = new NextRequest('http://x', { method: 'POST', body: JSON.stringify({}) })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(400)
  })

  it('sets payment_status to failed with the given reason', async () => {
    const req = new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ reason: 'Reference number does not match our records' }) })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockSendNotification).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        user_id: 'u-1',
        source_id: PAYMENT_ID,
        message: expect.stringContaining('Reference number does not match our records'),
      }),
    )
  })

  it('emails the booker with the QR proof rejected template when their email resolves', async () => {
    mockSupabase.from = () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: PAYMENT_ID, payment_status: 'pending_review', user_id: 'u-1', booking: { booking_reference: 'BK-3001' } }, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    })
    mockResolveUserEmail.mockResolvedValueOnce({ emailTo: 'renter@example.com', name: 'Jane Renter' })

    const req = new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ reason: 'Reference number does not match our records' }) })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockSendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'renter@example.com',
        subject: expect.stringMatching(/^\[ACTION REQUIRED\] Payment Proof Rejected — BK-3001$/),
        htmlBody: expect.stringContaining('Jane Renter'),
      })
    )
    const emailArg = mockSendBrevoEmail.mock.calls[0][0]
    expect(emailArg.htmlBody).toContain('Reference number does not match our records')
  })

  it('returns 500 and does not notify when the status update itself fails', async () => {
    mockSupabase.from = () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: PAYMENT_ID, payment_status: 'pending_review', user_id: 'u-1' }, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: { message: 'db unavailable' } }) }),
    })
    const req = new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ reason: 'bad reference' }) })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(500)
    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  it('still returns success when the post-reject notification throws after the status update already committed', async () => {
    mockSendNotification.mockRejectedValueOnce(new Error('network blip'))
    const req = new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ reason: 'bad reference' }) })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(200)
  })
})
