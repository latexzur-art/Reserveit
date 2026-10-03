import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockBuildingAdminUser, mockAuthGuard } from '../../mocks/auth'

vi.mock('@/lib/auth/guards', () => mockAuthGuard(mockBuildingAdminUser))

let mockSupabase: any
const createMockSupabase = () => ({
  from: vi.fn().mockReturnValue({
    upsert: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
})

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))

import { GET, PATCH } from '@/app/api/settings/payment-policy/route'

describe('/api/settings/payment-policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
  })

  describe('GET', () => {
    it('returns defaults when system_settings has no matching rows', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      })

      const res = await GET()
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.payment_method_mode).toBe('paymongo')
      expect(json.payment_helpdesk_contact).toBe('')
    })

    it('returns stored values when system_settings has both keys', async () => {
      const data = [
        { key: 'payment_method_mode', value: 'qr_at_submission' },
        { key: 'payment_helpdesk_contact', value: 'support@example.com' },
      ]
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      })

      const res = await GET()
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.payment_method_mode).toBe('qr_at_submission')
      expect(json.payment_helpdesk_contact).toBe('support@example.com')
    })

    it('returns defaults for missing keys when only one key exists', async () => {
      const data = [{ key: 'payment_method_mode', value: 'qr_after_approval' }]
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      })

      const res = await GET()
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.payment_method_mode).toBe('qr_after_approval')
      expect(json.payment_helpdesk_contact).toBe('')
    })
  })

  describe('PATCH', () => {
    it('rejects an invalid payment_method_mode value', async () => {
      const req = new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ payment_method_mode: 'bitcoin' }) })
      const res = await PATCH(req)
      expect(res.status).toBe(400)
    })

    it('accepts a valid mode', async () => {
      const req = new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ payment_method_mode: 'qr_after_approval' }) })
      const res = await PATCH(req)
      expect(res.status).toBe(200)
    })

    it('accepts a valid payment_helpdesk_contact string', async () => {
      const req = new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ payment_helpdesk_contact: 'support@example.com' }) })
      const res = await PATCH(req)
      expect(res.status).toBe(200)
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'payment_helpdesk_contact',
          value: 'support@example.com',
        }),
        expect.any(Object)
      )
    })

    it('rejects a non-string payment_helpdesk_contact', async () => {
      const req = new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ payment_helpdesk_contact: 123 }) })
      const res = await PATCH(req)
      expect(res.status).toBe(400)
    })

    it('rejects a non-string payment_helpdesk_contact (boolean)', async () => {
      const req = new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ payment_helpdesk_contact: true }) })
      const res = await PATCH(req)
      expect(res.status).toBe(400)
    })
  })
})
