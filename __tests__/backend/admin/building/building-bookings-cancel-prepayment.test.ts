import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Fake Supabase client ────────────────────────────────────────────────────
// Same pattern as building-bookings-approve-payment-mode.test.ts

type Row = Record<string, any>

function createFakeSupabase(initialTables: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {}
  for (const [name, rows] of Object.entries(initialTables)) {
    tables[name] = rows.map(r => ({ ...r }))
  }

  function from(table: string) {
    if (!tables[table]) tables[table] = []

    const filters: Array<(row: Row) => boolean> = []
    let mode: 'select' | 'insert' | 'update' = 'select'
    let insertPayload: Row[] | null = null
    let updatePayload: Row | null = null
    let limitCount: number | null = null

    function applyFilters(list: Row[]) {
      return list.filter(r => filters.every(f => f(r)))
    }

    function execute(): { data: any; error: any } {
      const rows = tables[table]

      if (mode === 'insert') {
        const created = insertPayload!.map(p => ({ id: p.id || `fake-${Math.random().toString(36).slice(2)}`, ...p }))
        rows.push(...created)
        return { data: created, error: null }
      }

      if (mode === 'update') {
        const matched = applyFilters(rows)
        matched.forEach(r => Object.assign(r, updatePayload))
        return { data: matched, error: null }
      }

      let result = applyFilters(rows).map(r => ({ ...r }))
      if (limitCount !== null) result = result.slice(0, limitCount)
      return { data: result, error: null }
    }

    const builder: any = {
      select() { return builder },
      insert(payload: Row | Row[]) { mode = 'insert'; insertPayload = Array.isArray(payload) ? payload : [payload]; return builder },
      update(payload: Row) { mode = 'update'; updatePayload = payload; return builder },
      eq(col: string, val: any) { filters.push(r => r[col] === val); return builder },
      in(col: string, vals: any[]) { filters.push(r => vals.includes(r[col])); return builder },
      limit(n: number) { limitCount = n; return builder },
      single() {
        const res = execute()
        if (res.error) return Promise.resolve(res)
        const data = res.data
        const row = Array.isArray(data) ? data[0] : data
        if (!row) return Promise.resolve({ data: null, error: { message: 'No rows found', code: 'PGRST116' } })
        return Promise.resolve({ data: row, error: null })
      },
      maybeSingle() {
        const res = execute()
        if (res.error) return Promise.resolve(res)
        const data = res.data
        return Promise.resolve({ data: Array.isArray(data) ? (data[0] ?? null) : data, error: null })
      },
      then(resolve: any, reject: any) {
        return Promise.resolve(execute()).then(resolve, reject)
      },
    }
    return builder
  }

  return { from, tables }
}

// ── Mocks ────────────────────────────────────────────────────────────────────

const fakeClientBox = vi.hoisted(() => ({ current: null as any }))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => fakeClientBox.current,
}))

vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/backend/credits/creditService', () => ({
  creditService: {
    issueCredit: vi.fn().mockResolvedValue(undefined),
  },
}))

import { BuildingBookingsMutations } from '@/backend/admin/building/building-bookings.mutations'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BOOKING_ID = 'booking-1'
const USER_ID = 'user-1'

function bookingRow(overrides: Partial<Row> = {}): Row {
  return {
    id: BOOKING_ID,
    current_status: 'pending_user_response',
    user_id: USER_ID,
    booking_reference: 'BK-20260813-001',
    booking_date: '2026-08-20',
    start_time: '09:00:00',
    end_time: '11:00:00',
    booking_purpose: 'personal',
    booking_facilities: [{ facility_id: 'fac-1', facility: [{ id: 'fac-1', name: 'Gymnasium' }] }],
    ...overrides,
  }
}

function paymentRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'pay-1',
    booking_id: BOOKING_ID,
    user_id: USER_ID,
    amount: 500,
    payment_status: 'pending',
    payment_method: 'qr_manual',
    payment_type: 'booking',
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BuildingBookingsMutations.cancel — pre-payment bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cancels a pending_user_response booking', async () => {
    fakeClientBox.current = createFakeSupabase({
      bookings: [bookingRow()],
      payments: [paymentRow()],
    })

    const result = await BuildingBookingsMutations.cancel(BOOKING_ID, 'User never paid')

    expect(result.current_status).toBe('cancelled')
    expect(result.cancellation_type).toBe('admin_cancelled')
  })

  it('voids the pending payment when cancelling a pending_user_response booking', async () => {
    fakeClientBox.current = createFakeSupabase({
      bookings: [bookingRow()],
      payments: [paymentRow()],
    })

    await BuildingBookingsMutations.cancel(BOOKING_ID, 'User never paid')

    const payment = fakeClientBox.current.tables.payments.find((p: Row) => p.booking_id === BOOKING_ID)
    expect(payment.payment_status).toBe('cancelled')
  })

  it('records the status transition in booking_status_history', async () => {
    fakeClientBox.current = createFakeSupabase({
      bookings: [bookingRow()],
      payments: [paymentRow()],
    })

    await BuildingBookingsMutations.cancel(BOOKING_ID, 'User never paid')

    const history = fakeClientBox.current.tables.booking_status_history.find(
      (h: Row) => h.booking_id === BOOKING_ID && h.new_status === 'cancelled'
    )
    expect(history).toBeDefined()
    expect(history.previous_status).toBe('pending_user_response')
    expect(history.reason).toBe('User never paid')
  })

  it('voids pending_review payments too (client already submitted QR proof)', async () => {
    fakeClientBox.current = createFakeSupabase({
      bookings: [bookingRow()],
      payments: [paymentRow({ payment_status: 'pending_review' })],
    })

    await BuildingBookingsMutations.cancel(BOOKING_ID, 'Cancelled after QR submitted')

    const payment = fakeClientBox.current.tables.payments.find((p: Row) => p.booking_id === BOOKING_ID)
    expect(payment.payment_status).toBe('cancelled')
  })

  it('marks pending cancellation requests as cancelled', async () => {
    fakeClientBox.current = createFakeSupabase({
      bookings: [bookingRow()],
      payments: [paymentRow()],
      cancellation_requests: [
        { id: 'cr-1', booking_id: BOOKING_ID, user_id: USER_ID, status: 'pending', reason: 'No longer needed for my event' },
      ],
    })

    await BuildingBookingsMutations.cancel(BOOKING_ID, 'BA cancelling directly')

    const cr = fakeClientBox.current.tables.cancellation_requests.find((r: Row) => r.id === 'cr-1')
    expect(cr.status).toBe('cancelled')
  })

  it('does not void a completed payment', async () => {
    fakeClientBox.current = createFakeSupabase({
      bookings: [bookingRow({ current_status: 'approved' })],
      payments: [paymentRow({ payment_status: 'completed' })],
    })

    await BuildingBookingsMutations.cancel(BOOKING_ID, 'BA cancelling paid booking')

    // Payment should NOT be voided — it was already completed (credit issuance handles this)
    const payment = fakeClientBox.current.tables.payments.find((p: Row) => p.booking_id === BOOKING_ID)
    expect(payment.payment_status).toBe('completed')
  })

  it('succeeds with no payment record (booking without payment)', async () => {
    fakeClientBox.current = createFakeSupabase({
      bookings: [bookingRow({ current_status: 'pending' })],
      payments: [],
    })

    const result = await BuildingBookingsMutations.cancel(BOOKING_ID, 'No payment needed')
    expect(result.current_status).toBe('cancelled')
  })
})
