import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockFacultyUser, mockAuthGuard } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockFacultyUser))

const mockCreateBucket = vi.fn().mockResolvedValue({ error: null })
const mockUpload = vi.fn().mockResolvedValue({ error: null })
const mockCreateSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://x/signed?token=abc' }, error: null })
const mockListBuckets = vi.fn().mockResolvedValue({ data: [{ name: 'payment-screenshots' }] })

const mockSupabase: any = {
  storage: {
    listBuckets: mockListBuckets,
    createBucket: mockCreateBucket,
    from: () => ({ upload: mockUpload, createSignedUrl: mockCreateSignedUrl }),
  },
}
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))

import { POST } from '@/app/api/payments/screenshot-upload/route'

// Real WebP file signature — RIFF....WEBP — magic-byte checks inspect actual
// content bytes, not the declared Content-Type, so fixtures need real bytes.
const WEBP_SIGNATURE = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x00, 0x00, 0x00, 0x00, // chunk size (unused by the signature check)
  0x57, 0x45, 0x42, 0x50, // "WEBP"
])

function makeRequest(form: FormData) {
  const req = new NextRequest('http://x/api/payments/screenshot-upload', { method: 'POST' })
  // jsdom loses File through the NextRequest body constructor — override directly.
  req.formData = () => Promise.resolve(form)
  return req
}

describe('POST /api/payments/screenshot-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListBuckets.mockResolvedValue({ data: [{ name: 'payment-screenshots' }] })
    mockUpload.mockResolvedValue({ error: null })
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://x/signed?token=abc' }, error: null })
  })

  it('rejects a request with no file', async () => {
    const form = new FormData()
    const req = makeRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects a file over the size limit', async () => {
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'shot.png', { type: 'image/png' })
    const form = new FormData()
    form.set('file', bigFile)
    const req = makeRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects an unsupported MIME type', async () => {
    const file = new File([new Uint8Array(10)], 'shot.pdf', { type: 'application/pdf' })
    const form = new FormData()
    form.set('file', file)
    const req = makeRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates the private bucket when missing', async () => {
    mockListBuckets.mockResolvedValueOnce({ data: [] })
    const file = new File([WEBP_SIGNATURE], 'shot.webp', { type: 'image/webp' })
    const form = new FormData()
    form.set('file', file)
    const req = makeRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockCreateBucket).toHaveBeenCalledWith('payment-screenshots', expect.objectContaining({ public: false }))
  })

  it('uploads a valid screenshot and returns a signed URL', async () => {
    const file = new File([WEBP_SIGNATURE], 'shot.webp', { type: 'image/webp' })
    const form = new FormData()
    form.set('file', file)
    const req = makeRequest(form)
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(201)
    expect(mockUpload).toHaveBeenCalled()
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(expect.any(String), expect.any(Number))
    expect(data.url).toBe('https://x/signed?token=abc')
  })

  it('scopes the storage path to the requesting user', async () => {
    const file = new File([WEBP_SIGNATURE], 'shot.webp', { type: 'image/webp' })
    const form = new FormData()
    form.set('file', file)
    const req = makeRequest(form)
    await POST(req)
    const uploadedPath = mockUpload.mock.calls[0][0] as string
    expect(uploadedPath.startsWith(`${mockFacultyUser.id}/`)).toBe(true)
  })

  it('rejects a file whose declared type is spoofed (bytes do not match a real image signature)', async () => {
    // Windows PE/EXE magic bytes ("MZ") disguised with a declared image/webp Content-Type —
    // simulates renaming malware.exe and spoofing the multipart Content-Type header.
    const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
    const file = new File([exeBytes], 'shot.webp', { type: 'image/webp' })
    const form = new FormData()
    form.set('file', file)
    const req = makeRequest(form)
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(mockUpload).not.toHaveBeenCalled()
  })
})
