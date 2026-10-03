import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))

const PAYMENT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

const { mockResolveDispute, mockAuditLog } = vi.hoisted(() => {
  const mockResolveDispute = vi.fn().mockResolvedValue(undefined)
  const mockAuditLog = vi.fn().mockResolvedValue(undefined)
  return { mockResolveDispute, mockAuditLog }
})

vi.mock('@/backend/payments/manualRefundService', () => ({
  ManualRefundService: { resolveDispute: mockResolveDispute },
}))
vi.mock('@/backend/admin/admin-audit.service', () => ({
  AdminAuditService: { log: mockAuditLog },
}))

import { POST } from '@/app/api/admin/building/payments/[id]/resolve-dispute/route'

describe('POST /api/admin/building/payments/[id]/resolve-dispute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveDispute.mockResolvedValue(undefined)
  })

  it('returns 200 and calls resolveDispute on valid request', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({
        reference_number: 'GCASH-REF-12345',
        screenshot_url: 'https://cdn.example.com/proof.png',
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(200)
    expect(mockResolveDispute).toHaveBeenCalledWith(
      PAYMENT_ID,
      'GCASH-REF-12345',
      'https://cdn.example.com/proof.png',
      mockBuildingAdminUser.id,
    )
  })

  it('logs to audit service on success', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({
        reference_number: 'GCASH-REF-12345',
        screenshot_url: 'https://cdn.example.com/proof.png',
      }),
    })
    await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'refund_dispute_resolved',
      targetType: 'payment',
      targetId: PAYMENT_ID,
    }))
  })

  it('returns 400 when reference_number is missing', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ screenshot_url: 'https://cdn.example.com/proof.png' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 when screenshot_url is missing', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({ reference_number: 'GCASH-REF-12345' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when service throws refund_not_found', async () => {
    mockResolveDispute.mockRejectedValueOnce(new Error('refund_not_found'))
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({
        reference_number: 'GCASH-REF-12345',
        screenshot_url: 'https://cdn.example.com/proof.png',
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(404)
  })

  it('returns 409 when service throws not_disputed', async () => {
    mockResolveDispute.mockRejectedValueOnce(new Error('not_disputed'))
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({
        reference_number: 'GCASH-REF-12345',
        screenshot_url: 'https://cdn.example.com/proof.png',
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: PAYMENT_ID }) })
    expect(res.status).toBe(409)
  })

  it('returns 400 for invalid UUID', async () => {
    const req = new NextRequest('http://x', {
      method: 'POST',
      body: JSON.stringify({
        reference_number: 'GCASH-REF-12345',
        screenshot_url: 'https://cdn.example.com/proof.png',
      }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'not-a-uuid' }) })
    expect(res.status).toBe(400)
  })
})
