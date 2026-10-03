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

describe('ManualRefundService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of chainMethods) mockSupabase[m] = vi.fn().mockReturnValue(mockSupabase)
    mockSupabase.limit = vi.fn().mockResolvedValue({ data: [], error: null })
  })

  it('override rejects an amount greater than total_amount', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'p-1', total_amount: 500, payment_status: 'completed', booking_id: 'b-1' }, error: null })
    await expect(ManualRefundService.override({
      paymentId: 'p-1', amount: 999, justificationNote: 'agreed refund', destinationName: 'Jane', destinationContactNumber: '0917',
      recordedBy: 'u-ba',
    })).rejects.toThrow('amount_exceeds_total')
  })

  it('rejects a second refund on the same payment', async () => {
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'p-1', total_amount: 500, payment_status: 'refunded', booking_id: 'b-1' }, error: null })
    await expect(ManualRefundService.override({
      paymentId: 'p-1', amount: 500, justificationNote: 'agreed refund', destinationName: 'Jane', destinationContactNumber: '0917',
      recordedBy: 'u-ba',
    })).rejects.toThrow('already_refunded')
  })

  it('records a valid override with pending_proof status', async () => {
    // Override calls: from().select().eq().single() for payment lookup,
    // from().select().eq().limit() for duplicate check,
    // from().insert() for refund row,
    // from().update().eq() for payment status update
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'p-1', total_amount: 500, payment_status: 'completed', booking_id: 'b-1' }, error: null })
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null })
    mockSupabase.insert.mockResolvedValueOnce({ data: { id: 'refund-1' }, error: null })
    // eq is used in both select().eq().single() and update().eq() — make it always chainable
    mockSupabase.eq.mockReturnValue(mockSupabase)
    mockSupabase.update.mockReturnValue(mockSupabase)

    await expect(ManualRefundService.override({
      paymentId: 'p-1', amount: 500, justificationNote: 'agreed refund', destinationName: 'Jane', destinationContactNumber: '0917',
      recordedBy: 'u-ba',
    })).resolves.toBeUndefined()

    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending_proof' }))
  })

  it('confirmEntitlement rejects when the cancellation request is not in an approved status', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'cr-1', booking_id: 'b-1', status: 'pending', refund_destination_name: 'Jane', refund_destination_contact_number: '0917' },
      error: null,
    })
    await expect(ManualRefundService.confirmEntitlement({
      cancellationRequestId: 'cr-1', recordedBy: 'u-ba',
    })).rejects.toThrow('cancellation_not_approved')
  })

  it('confirmEntitlement resolves and returns the actual refunded payment id and amount', async () => {
    mockSupabase.single
      .mockResolvedValueOnce({
        data: { id: 'cr-1', booking_id: 'b-1', status: 'approved_no_strike', refund_destination_name: 'Jane', refund_destination_contact_number: '0917' },
        error: null,
      })
    mockSupabase.limit
      .mockResolvedValueOnce({ data: [{ id: 'p-resolved', total_amount: 750, payment_status: 'refund_requested', booking_id: 'b-1' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    mockSupabase.insert.mockResolvedValueOnce({ data: { id: 'refund-2' }, error: null })

    await expect(ManualRefundService.confirmEntitlement({
      cancellationRequestId: 'cr-1', recordedBy: 'u-ba',
    })).resolves.toEqual({ paymentId: 'p-resolved', amount: 750 })
  })

  it('confirmEntitlement allows approved_with_strike as an approved status', async () => {
    mockSupabase.single
      .mockResolvedValueOnce({
        data: { id: 'cr-1', booking_id: 'b-1', status: 'approved_with_strike', refund_destination_name: 'Jane', refund_destination_contact_number: '0917' },
        error: null,
      })
    mockSupabase.limit
      .mockResolvedValueOnce({ data: [{ id: 'p-2', total_amount: 300, payment_status: 'refund_requested', booking_id: 'b-1' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    mockSupabase.insert.mockResolvedValueOnce({ data: { id: 'refund-3' }, error: null })

    await expect(ManualRefundService.confirmEntitlement({
      cancellationRequestId: 'cr-1', recordedBy: 'u-ba',
    })).resolves.toEqual({ paymentId: 'p-2', amount: 300 })
  })

  it('confirmEntitlement allows auto_approved as an approved status', async () => {
    mockSupabase.single
      .mockResolvedValueOnce({
        data: { id: 'cr-1', booking_id: 'b-1', status: 'auto_approved', refund_destination_name: 'Jane', refund_destination_contact_number: '0917' },
        error: null,
      })
    mockSupabase.limit
      .mockResolvedValueOnce({ data: [{ id: 'p-3', total_amount: 400, payment_status: 'refund_requested', booking_id: 'b-1' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    mockSupabase.insert.mockResolvedValueOnce({ data: { id: 'refund-4' }, error: null })

    await expect(ManualRefundService.confirmEntitlement({
      cancellationRequestId: 'cr-1', recordedBy: 'u-ba',
    })).resolves.toEqual({ paymentId: 'p-3', amount: 400 })
  })

  it('confirmEntitlement uses capped amount when provided instead of full payment', async () => {
    mockSupabase.single
      .mockResolvedValueOnce({
        data: { id: 'cr-1', booking_id: 'b-1', status: 'approved_no_strike', refund_destination_name: 'Jane', refund_destination_contact_number: '0917' },
        error: null,
      })
    mockSupabase.limit
      .mockResolvedValueOnce({ data: [{ id: 'p-5', total_amount: 1000, payment_status: 'refund_requested', booking_id: 'b-1' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    mockSupabase.insert.mockResolvedValueOnce({ data: { id: 'refund-5' }, error: null })

    const result = await ManualRefundService.confirmEntitlement({
      cancellationRequestId: 'cr-1', recordedBy: 'u-ba', amount: 300,
    })

    expect(result).toEqual({ paymentId: 'p-5', amount: 300 })
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({ amount: 300 }))
  })

  it('confirmEntitlement rejects capped amount that exceeds total_amount', async () => {
    mockSupabase.single
      .mockResolvedValueOnce({
        data: { id: 'cr-1', booking_id: 'b-1', status: 'approved_no_strike', refund_destination_name: 'Jane', refund_destination_contact_number: '0917' },
        error: null,
      })
    mockSupabase.limit
      .mockResolvedValueOnce({ data: [{ id: 'p-6', total_amount: 500, payment_status: 'refund_requested', booking_id: 'b-1' }], error: null })

    await expect(ManualRefundService.confirmEntitlement({
      cancellationRequestId: 'cr-1', recordedBy: 'u-ba', amount: 999,
    })).rejects.toThrow('amount_exceeds_total')
  })
})
