import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))

const { mockUpdate, mockRemove } = vi.hoisted(() => ({
  mockUpdate: vi.fn().mockResolvedValue(undefined),
  mockRemove: vi.fn(),
}))
vi.mock('@/backend/payments/qrCodeService', () => ({ QrCodeService: { update: mockUpdate, remove: mockRemove } }))

import { PATCH, DELETE } from '@/app/api/admin/building/payment-qr-codes/[id]/route'

const VALID_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

describe('/api/admin/building/payment-qr-codes/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PATCH toggles is_active', async () => {
    const req = new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ is_active: false }) })
    const res = await PATCH(req, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(VALID_UUID, { isActive: false })
  })

  it('DELETE returns 409 when the code has payment history', async () => {
    mockRemove.mockRejectedValueOnce(new Error('has_history'))
    const req = new NextRequest('http://x', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(409)
  })

  it('PATCH returns 400 with invalid body (non-boolean is_active)', async () => {
    const req = new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ is_active: 'not-a-boolean' }) })
    const res = await PATCH(req, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('PATCH returns 400 with invalid UUID', async () => {
    const req = new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ is_active: false }) })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'not-a-uuid' }) })
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
