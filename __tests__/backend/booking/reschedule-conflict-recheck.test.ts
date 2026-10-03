import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Track whether checkBookingConflict returns a conflict on re-check
let conflictOnRecheck = false

vi.mock('@/lib/bookings/check-conflict', () => ({
  checkBookingConflict: vi.fn().mockImplementation(async () => {
    if (conflictOnRecheck) {
      return { conflict: true, conflicting_booking_reference: 'REF-STOLEN' }
    }
    return { conflict: false }
  }),
}))

const rpcMock = vi.fn().mockResolvedValue({ data: true, error: null })

const mockSupabase: any = {}
for (const m of ['from', 'select', 'eq', 'in', 'update'] as const) {
  mockSupabase[m] = vi.fn().mockImplementation(() => mockSupabase)
}
mockSupabase.single = vi.fn().mockResolvedValue({
  data: {
    id: 'req-1',
    booking_id: 'booking-1',
    user_id: 'user-1',
    status: 'pending',
    extra_amount_centavos: 0,
    proposed_date: '2026-09-02',
    proposed_start_time: '07:00:00',
    proposed_end_time: '10:00:00',
    original_date: '2026-09-01',
    original_start_time: '07:00:00',
    original_end_time: '10:00:00',
  },
  error: null,
})
mockSupabase.insert = vi.fn().mockReturnValue(mockSupabase)
mockSupabase.rpc = rpcMock
mockSupabase.then = function (resolve: any, reject?: any) {
  return Promise.resolve({ data: null, error: null }).then(resolve, reject)
}

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockSupabase,
}))

vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  sendNotificationToRoles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue({ success: false, skipped: true }),
}))

vi.mock('@/backend/notifications/emailTemplates', () => ({
  rescheduleRequestApprovedNoExtraEmail: vi.fn().mockReturnValue({ subject: 'S', htmlBody: '<p>H</p>' }),
  rescheduleRequestApprovedWithExtraEmail: vi.fn().mockReturnValue({ subject: 'S', htmlBody: '<p>H</p>' }),
  rescheduleConfirmedAfterPaymentEmail: vi.fn().mockReturnValue({ subject: 'S', htmlBody: '<p>H</p>' }),
}))

vi.mock('@/backend/notifications/recipientResolver', () => ({
  getBuildingAdminEmails: vi.fn().mockResolvedValue([]),
  resolveUserEmail: vi.fn().mockResolvedValue({ emailTo: 'user@test.com', name: 'Test User' }),
  resolveUserPageUrls: vi.fn().mockResolvedValue({ bookingsUrl: '/faculty/reservations', paymentUrl: '/faculty/payments' }),
}))

vi.mock('@/lib/refund-eligibility', () => ({
  isRefundWindowMet: vi.fn().mockReturnValue(true),
}))

vi.mock('@/backend/admin/building/building-pricing.service', () => ({
  BuildingPricingService: {
    getRateConfig: vi.fn().mockResolvedValue(undefined),
  },
}))

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('reschedule conflict re-check on approval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    conflictOnRecheck = false
    // Restore the single() mock for the request fetch
    mockSupabase.single = vi.fn()
      // First call: fetch request
      .mockResolvedValueOnce({
        data: {
          id: 'req-1',
          booking_id: 'booking-1',
          user_id: 'user-1',
          status: 'pending',
          extra_amount_centavos: 0,
          proposed_date: '2026-09-02',
          proposed_start_time: '07:00:00',
          proposed_end_time: '10:00:00',
          original_date: '2026-09-01',
          original_start_time: '07:00:00',
          original_end_time: '10:00:00',
        },
        error: null,
      })
      // Second call: fetch booking
      .mockResolvedValueOnce({
        data: {
          id: 'booking-1',
          user_id: 'user-1',
          booking_reference: 'REF-001',
          booking_date: '2026-09-01',
          start_time: '07:00:00',
          end_time: '10:00:00',
          booking_facilities: [{ facility_id: 'facility-1', facilities: { name: 'Main Hall' } }],
        },
        error: null,
      })
  })

  it('rejects no-extra approval when conflict exists at approval time', async () => {
    conflictOnRecheck = true

    const { approveRescheduleRequest } = await import('@/backend/booking/emergencyRescheduleRequestService')

    const result = await approveRescheduleRequest({
      requestId: 'req-1',
      adminUserId: 'admin-1',
      reviewNotes: 'Approving',
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain('occupied')
    // The RPC to apply the reschedule should NOT have been called
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('approves no-extra request when no conflict at approval time', async () => {
    conflictOnRecheck = false

    const { approveRescheduleRequest } = await import('@/backend/booking/emergencyRescheduleRequestService')

    const result = await approveRescheduleRequest({
      requestId: 'req-1',
      adminUserId: 'admin-1',
      reviewNotes: 'Approving',
    })

    expect(result.success).toBe(true)
    // The RPC to apply the reschedule SHOULD have been called
    expect(rpcMock).toHaveBeenCalledWith('apply_user_emergency_reschedule', expect.objectContaining({
      p_booking_id: 'booking-1',
      p_request_id: 'req-1',
    }))
  })

  it('rejects post-payment apply when conflict exists at apply time', async () => {
    conflictOnRecheck = true

    // Override single() for applyRescheduleOnPayment flow
    mockSupabase.single = vi.fn()
      // First: fetch payment
      .mockResolvedValueOnce({
        data: {
          id: 'payment-1',
          booking_id: 'booking-1',
          user_id: 'user-1',
          amount: 500,
          payment_type: 'reschedule_extra',
          payment_status: 'completed',
          metadata: { reschedule_request_id: 'req-1' },
        },
        error: null,
      })
      // Second: fetch reschedule request
      .mockResolvedValueOnce({
        data: {
          id: 'req-1',
          booking_id: 'booking-1',
          user_id: 'user-1',
          status: 'pending_extra_payment',
          proposed_date: '2026-09-02',
          proposed_start_time: '07:00:00',
          proposed_end_time: '10:00:00',
        },
        error: null,
      })
      // Third: fetch booking (for facility info)
      .mockResolvedValueOnce({
        data: {
          id: 'booking-1',
          booking_reference: 'REF-001',
          booking_facilities: [{ facility_id: 'facility-1', facilities: { name: 'Main Hall' } }],
        },
        error: null,
      })

    const { applyRescheduleOnPayment } = await import('@/backend/booking/emergencyRescheduleRequestService')

    const result = await applyRescheduleOnPayment('payment-1')

    expect(result.applied).toBe(false)
    expect(result.message).toContain('occupied')
    // RPC should NOT have been called
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('applies post-payment reschedule when no conflict at apply time', async () => {
    conflictOnRecheck = false

    mockSupabase.single = vi.fn()
      .mockResolvedValueOnce({
        data: {
          id: 'payment-1',
          booking_id: 'booking-1',
          user_id: 'user-1',
          amount: 500,
          payment_type: 'reschedule_extra',
          payment_status: 'completed',
          metadata: { reschedule_request_id: 'req-1' },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'req-1',
          booking_id: 'booking-1',
          user_id: 'user-1',
          status: 'pending_extra_payment',
          proposed_date: '2026-09-02',
          proposed_start_time: '07:00:00',
          proposed_end_time: '10:00:00',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'booking-1',
          booking_reference: 'REF-001',
          booking_facilities: [{ facility_id: 'facility-1', facilities: { name: 'Main Hall' } }],
        },
        error: null,
      })

    const { applyRescheduleOnPayment } = await import('@/backend/booking/emergencyRescheduleRequestService')

    const result = await applyRescheduleOnPayment('payment-1')

    expect(result.applied).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('apply_user_emergency_reschedule', expect.objectContaining({
      p_booking_id: 'booking-1',
    }))
  })
})
