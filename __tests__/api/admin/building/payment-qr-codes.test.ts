import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockBuildingAdminUser, mockAuthGuard } from '../../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))

const { mockList, mockCreate } = vi.hoisted(() => ({
  mockList: vi.fn().mockResolvedValue([]),
  mockCreate: vi.fn().mockResolvedValue({ id: 'qc-1', label: 'GCash', image_url: 'https://x/gcash.png', is_active: true, display_order: 0, created_at: '2026-08-12' }),
}))
vi.mock('@/backend/payments/qrCodeService', () => ({ QrCodeService: { listAll: mockList, create: mockCreate } }))

const mockSupabase: any = vi.hoisted(() => ({ storage: { listBuckets: vi.fn().mockResolvedValue({ data: [{ name: 'payment-qr-codes' }] }), from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://x/gcash.png' } }) }) } }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))

import { GET, POST } from '@/app/api/admin/building/payment-qr-codes/route'

// Real PNG file signature (8-byte header) — magic-byte checks inspect actual
// content bytes, not the declared Content-Type, so fixtures need real bytes.
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('/api/admin/building/payment-qr-codes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET returns all QR codes including inactive', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(mockList).toHaveBeenCalled()
  })

  it('POST rejects a file that is too large', async () => {
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'qr.png', { type: 'image/png' })
    const form = new FormData()
    form.set('label', 'GCash')
    form.set('file', bigFile)
    const req = new NextRequest('http://x/api/admin/building/payment-qr-codes', { method: 'POST' })
    // jsdom loses File through the NextRequest body constructor (see __tests__/api/courses/upload.test.ts) — override directly.
    req.formData = () => Promise.resolve(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST creates a QR code from a valid upload', async () => {
    const file = new File([PNG_SIGNATURE], 'qr.png', { type: 'image/png' })
    const form = new FormData()
    form.set('label', 'GCash')
    form.set('file', file)
    const req = new NextRequest('http://x/api/admin/building/payment-qr-codes', { method: 'POST' })
    req.formData = () => Promise.resolve(form)
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ label: 'GCash' }))
  })

  it('POST rejects a missing label field', async () => {
    const file = new File([new Uint8Array(10)], 'qr.png', { type: 'image/png' })
    const form = new FormData()
    form.set('file', file)
    const req = new NextRequest('http://x/api/admin/building/payment-qr-codes', { method: 'POST' })
    req.formData = () => Promise.resolve(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST rejects an empty label field', async () => {
    const file = new File([new Uint8Array(10)], 'qr.png', { type: 'image/png' })
    const form = new FormData()
    form.set('label', '')
    form.set('file', file)
    const req = new NextRequest('http://x/api/admin/building/payment-qr-codes', { method: 'POST' })
    req.formData = () => Promise.resolve(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST rejects an unsupported file MIME type', async () => {
    const file = new File([new Uint8Array(10)], 'qr.pdf', { type: 'application/pdf' })
    const form = new FormData()
    form.set('label', 'GCash')
    form.set('file', file)
    const req = new NextRequest('http://x/api/admin/building/payment-qr-codes', { method: 'POST' })
    req.formData = () => Promise.resolve(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST rejects a file whose declared type is spoofed (bytes do not match a real image signature)', async () => {
    // Windows PE/EXE magic bytes ("MZ") disguised with a declared image/png Content-Type —
    // simulates renaming malware.exe and spoofing the multipart Content-Type header.
    const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
    const file = new File([exeBytes], 'qr.png', { type: 'image/png' })
    const form = new FormData()
    form.set('label', 'GCash')
    form.set('file', file)
    const req = new NextRequest('http://x/api/admin/building/payment-qr-codes', { method: 'POST' })
    req.formData = () => Promise.resolve(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
    // Must reject before ever reaching storage upload / QR code creation.
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
