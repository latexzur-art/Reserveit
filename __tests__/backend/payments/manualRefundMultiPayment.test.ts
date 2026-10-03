import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase: any = {}
const chainMethods = ['from', 'select', 'eq', 'single', 'insert', 'limit', 'update', 'neq'] as const
for (const m of chainMethods) mockSupabase[m] = vi.fn().mockReturnValue(mockSupabase)
// Make limit return a promise by default so chains like .select().eq().limit() resolve
mockSupabase.limit = vi.fn().mockResolvedValue({ data: [], error: null })
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => mockSupabase }))
vi.mock('@/backend/booking/autoDecisionRouter', () => ({ sendNotification: vi.fn(), sendNotificationToRoles: vi.fn() }))
vi.mock('@/backend/notifications/recipientResolver', () => ({ resolveUserEmail: vi.fn().mockResolvedValue({ emailTo: null, name: null }) }))
vi.mock('@/backend/notifications/brevoEmailService', () => ({ sendBrevoEmail: vi.fn() }))
vi.mock('@/backend/notifications/emailTemplates', () => ({ bookerRefundProofEmail: vi.fn().mockReturnValue({ subject: '', htmlBody: '' }) }))

import { ManualRefundService } from '@/backend/payments/manualRefundService'

describe('ManualRefundService — multi-payment hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of chainMethods) mockSupabase[m] = vi.fn().mockReturnValue(mockSupabase)
    mockSupabase.limit = vi.fn().mockResolvedValue({ data: [], error: null })
  })

  it('confirmEntitlement handles multiple refund_requested payments without throwing PGRST116', async () => {
    // cancellation request lookup (uses .single() — that's fine, always 1 row)
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: 'cr-1',
        booking_id: 'b-1',
        status: 'approved_no_strike',
        refund_destination_name: 'Jane',
        refund_destination_contact_number: '0917',
      },
      error: null,
    })

    // payment lookup — previously .single() would throw PGRST116 here
    // because multiple rows matched. After the fix, this uses .limit(1)
    // which returns an array. We mock limit to return 2 rows.
    mockSupabase.limit
      // first limit call: payment lookup (returns array with 2 payments)
      .mockResolvedValueOnce({
        data: [
          { id: 'p-1', total_amount: 500, payment_status: 'refund_requested', booking_id: 'b-1' },
          { id: 'p-2', total_amount: 300, payment_status: 'refund_requested', booking_id: 'b-1' },
        ],
        error: null,
      })
      // second limit call: duplicate refund check
      .mockResolvedValueOnce({ data: [], error: null })

    mockSupabase.insert.mockResolvedValueOnce({ data: { id: 'refund-1' }, error: null })

    const result = await ManualRefundService.confirmEntitlement({
      cancellationRequestId: 'cr-1',
      recordedBy: 'u-ba',
    })

    // Should pick the first payment and succeed
    expect(result).toEqual({ paymentId: 'p-1', amount: 500 })
  })

  it('confirmEntitlement throws no_refund_owed when payment list is empty', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: 'cr-2',
        booking_id: 'b-2',
        status: 'approved_no_strike',
        refund_destination_name: 'Jane',
        refund_destination_contact_number: '0917',
      },
      error: null,
    })

    // payment lookup returns empty array
    mockSupabase.limit
      .mockResolvedValueOnce({ data: [], error: null })

    await expect(ManualRefundService.confirmEntitlement({
      cancellationRequestId: 'cr-2',
      recordedBy: 'u-ba',
    })).rejects.toThrow('no_refund_owed')
  })
})
