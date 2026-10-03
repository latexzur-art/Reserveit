import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Fake Supabase client ────────────────────────────────────────────────────
//
// Minimal in-memory fake Postgrest client, same style as
// __tests__/backend/admin/building/building-equipment.service.test.ts (that
// file's header explains the rationale). Trimmed down to just what
// BuildingBookingsMutations.approve() touches: bookings (fetch + update),
// booking_decisions/booking_status_history (insert), system_settings
// (payment_method_mode lookup), payments (existing-check + insert), and
// users/user_roles (read inside the fire-and-forget email block, which this
// test lets no-op by leaving those tables empty).

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

vi.mock('@/backend/booking/paymentService', () => ({
  BookingPaymentService: {
    calculateAmount: vi.fn().mockResolvedValue({ amount: 500, breakdown: [] }),
  },
}))

vi.mock('@/backend/booking/autoDecisionRouter', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/notifications/brevoEmailService', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue({ success: true }),
}))

import { BuildingBookingsMutations } from '@/backend/admin/building/building-bookings.mutations'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BOOKING_ID = 'booking-1'
const USER_ID = 'user-1'

function bookingRow(overrides: Partial<Row> = {}): Row {
  return {
    id: BOOKING_ID,
    current_status: 'pending',
    user_id: USER_ID,
    booking_reference: 'REF-001',
    oversight_expires_at: null,
    decision_score: 90,
    requires_payment: true,
    is_extension: false,
    extension_of_booking_id: null,
    booking_date: '2026-08-20',
    start_time: '09:00:00',
    end_time: '11:00:00',
    booking_purpose: 'personal',
    booking_type: 'gym',
    metadata: {},
    booking_facilities: [{ facility_id: 'fac-1', facility: { id: 'fac-1', name: 'Gymnasium' } }],
    ...overrides,
  }
}

describe('BuildingBookingsMutations.approve — payment_method_mode wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts a payment with payment_method="qr_manual" when payment_method_mode is "qr_after_approval"', async () => {
    fakeClientBox.current = createFakeSupabase({
      bookings: [bookingRow()],
      system_settings: [{ key: 'payment_method_mode', value: 'qr_after_approval' }],
      payments: [],
    })

    await BuildingBookingsMutations.approve(BOOKING_ID)

    const payment = fakeClientBox.current.tables.payments.find((p: Row) => p.booking_id === BOOKING_ID)
    expect(payment).toBeDefined()
    expect(payment.payment_method).toBe('qr_manual')
  })

  it('still inserts a payment with payment_method="paymongo_card" when payment_method_mode is unset', async () => {
    fakeClientBox.current = createFakeSupabase({
      bookings: [bookingRow()],
      system_settings: [],
      payments: [],
    })

    await BuildingBookingsMutations.approve(BOOKING_ID)

    const payment = fakeClientBox.current.tables.payments.find((p: Row) => p.booking_id === BOOKING_ID)
    expect(payment).toBeDefined()
    expect(payment.payment_method).toBe('paymongo_card')
  })
})
