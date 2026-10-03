import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockFacultyUser, mockAuthGuard } from '../../mocks/auth'

const VALID_PAYMENT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const VALID_QR_CODE_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))
const { mockSubmit } = vi.hoisted(() => ({ mockSubmit: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/backend/payments/qrSubmissionService', () => ({ QrSubmissionService: { submit: mockSubmit } }))
const mockSupabase: any = { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { user_id: mockFacultyUser.id, booking: { booking_reference: 'BK-2001' } }, error: null }) }) }) }) }
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))
const { mockSendNotificationToRoles } = vi.hoisted(() => ({ mockSendNotificationToRoles: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/backend/booking/autoDecisionRouter', () => ({ sendNotificationToRoles: mockSendNotificationToRoles }))
const { mockSendBrevoEmail, mockGetBuildingAdminEmails } = vi.hoisted(() => ({
  mockSendBrevoEmail: vi.fn().mockResolvedValue(undefined),
  mockGetBuildingAdminEmails: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/backend/notifications/brevoEmailService', () => ({ sendBrevoEmail: mockSendBrevoEmail }))
vi.mock('@/backend/notifications/recipientResolver', () => ({ getBuildingAdminEmails: mockGetBuildingAdminEmails }))

import { POST } from '@/app/api/payments/[id]/qr-submit/route'

describe('POST /api/payments/[id]/qr-submit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires payer_name, payer_contact_number, reference_number, and qr_code_id', async () => {
    const req = new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ reference_number: 'REF-1' }) })
    const res = await POST(req, { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    expect(res.status).toBe(400)
  })

  it('submits successfully with all required fields', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ qr_code_id: VALID_QR_CODE_ID, payer_name: 'Jane', payer_contact_number: '0917', reference_number: 'REF-1' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockSubmit).toHaveBeenCalled()
  })

  it('emails building admins with the QR proof submitted template when admins exist', async () => {
    mockGetBuildingAdminEmails.mockResolvedValueOnce(['admin@example.com'])
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ qr_code_id: VALID_QR_CODE_ID, payer_name: 'Jane Doe Submitter', payer_contact_number: '0917', reference_number: 'REF-777' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockSendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['admin@example.com'],
        subject: expect.stringMatching(/^\[REVIEW\] QR Payment Proof Submitted — BK-2001$/),
        htmlBody: expect.stringContaining('Jane Doe Submitter'),
      })
    )
    const emailArg = mockSendBrevoEmail.mock.calls[0][0]
    expect(emailArg.htmlBody).toContain('REF-777')
  })

  it('still returns success when the post-submit admin notification throws after the submission already committed', async () => {
    mockSendNotificationToRoles.mockRejectedValueOnce(new Error('network blip'))
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ qr_code_id: VALID_QR_CODE_ID, payer_name: 'Jane', payer_contact_number: '0917', reference_number: 'REF-1' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockSubmit).toHaveBeenCalled()
  })

  it('accepts optional payer_account_name and payer_account_number and passes them to the submission service', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({
        qr_code_id: VALID_QR_CODE_ID,
        payer_name: 'Jane',
        payer_contact_number: '0917',
        reference_number: 'REF-1',
        payer_account_name: 'Jane Mendoza',
        payer_account_number: '09171234567',
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        payerAccountName: 'Jane Mendoza',
        payerAccountNumber: '09171234567',
      })
    )
  })

  it('allows submission without payer account fields (backwards compatible)', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ qr_code_id: VALID_QR_CODE_ID, payer_name: 'Jane', payer_contact_number: '0917', reference_number: 'REF-1' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: VALID_PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        payerAccountName: undefined,
        payerAccountNumber: undefined,
      })
    )
  })
})
