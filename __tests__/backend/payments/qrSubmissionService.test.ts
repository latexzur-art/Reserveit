import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase: any = {}
const chainMethods = ['from', 'select', 'eq', 'single', 'insert', 'update'] as const
for (const m of chainMethods) mockSupabase[m] = vi.fn().mockReturnValue(mockSupabase)
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))

import { QrSubmissionService } from '@/backend/payments/qrSubmissionService'

describe('QrSubmissionService.submit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects when the payment is already completed', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'p-1', payment_status: 'completed' }, error: null })
    await expect(QrSubmissionService.submit({
      paymentId: 'p-1', qrCodeId: 'qc-1', payerName: 'Jane', payerContactNumber: '0917', referenceNumber: 'REF-1',
    })).rejects.toThrow('invalid_status')
  })

  it('rejects when the qr code no longer exists', async () => {
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'p-1', payment_status: 'pending' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
    await expect(QrSubmissionService.submit({
      paymentId: 'p-1', qrCodeId: 'qc-deleted', payerName: 'Jane', payerContactNumber: '0917', referenceNumber: 'REF-1',
    })).rejects.toThrow('qr_code_removed')
  })
})
