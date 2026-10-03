/**
 * Integration tests — Payment Completion amount cross-check
 *
 * These tests hit the REAL Supabase database.
 * They exercise the `complete_payment` RPC's credit-aware amount check
 * (supabase/migrations/20260730010000_complete_payment_amount_check.sql):
 * a payment may only complete when cash + applied credits cover total_amount.
 *
 * All test data uses TST_ prefix for easy identification and cleanup.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { config } from 'dotenv'
import { resolve } from 'path'
import { NextRequest } from 'next/server'
import { fetch as undiciFetch } from 'undici'

// Load real credentials — overrides the fake keys set by __tests__/setup.ts
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import { makeAdminClient, seedPaidBooking } from './helpers/seedPaidBooking'

// Only auth is mocked — checkout/route.ts otherwise talks to the real DB via
// createAdminClient(), which reads the real env vars loaded above.
vi.mock('@/lib/auth/guards', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

// __tests__/setup.ts replaces global.fetch with a bare vi.fn() (no real network
// calls in the default unit-test gate). This integration suite needs the real
// thing — createAdminClient() (used by both the RPC calls above and the route
// under test below) resolves fetch off the global at call time, same as
// seedPaidBooking's makeAdminClient() does explicitly.
global.fetch = undiciFetch as unknown as typeof globalThis.fetch

const admin = makeAdminClient()

let cleanupFns: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const cleanup of cleanupFns) {
    await cleanup()
  }
  cleanupFns = []
})

describe('complete_payment — credit-aware amount cross-check (real DB)', () => {
  it('rejects an underpaid cash payment, leaves it pending, writes a PAYMENT_UNDERPAID audit row', async () => {
    const { paymentId, cleanup } = await seedPaidBooking(admin, { totalPesos: 100 })
    cleanupFns.push(cleanup)

    const { data, error } = await admin.rpc('complete_payment', {
      p_payment_id: paymentId,
      p_paymongo_data: null,
      p_amount_centavos: 5000, // owed = 10000 centavos; underpaid
    })

    expect(error).toBeNull()
    expect(data).toBe(false)

    const { data: payment } = await admin
      .from('payments')
      .select('payment_status')
      .eq('id', paymentId)
      .single()
    expect(payment?.payment_status).toBe('pending')

    const { data: auditRows } = await admin
      .from('financial_audit')
      .select('action')
      .eq('payment_id', paymentId)
      .eq('action', 'PAYMENT_UNDERPAID')
    expect(auditRows).toHaveLength(1)
  })

  it('completes a fully credit-covered payment (cash = 0)', async () => {
    const { paymentId, bookingId, userId, cleanup } = await seedPaidBooking(admin, { totalPesos: 100 })
    cleanupFns.push(cleanup)

    const { error: creditErr } = await admin.from('session_credits').insert({
      user_id: userId,
      amount_centavos: -10000,
      event_type: 'applied',
      source: 'checkout_application',
      applied_to_payment_id: paymentId,
      applied_to_booking_id: bookingId,
      reason: 'TST_ test credit',
    })
    expect(creditErr).toBeNull()

    const { data, error } = await admin.rpc('complete_payment', {
      p_payment_id: paymentId,
      p_paymongo_data: null,
      p_amount_centavos: 0,
    })

    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  it('officially books a payment on a pending_user_response booking (admin already approved)', async () => {
    const { paymentId, bookingId, cleanup } = await seedPaidBooking(admin, {
      totalPesos: 100,
      currentStatus: 'pending_user_response',
    })
    cleanupFns.push(cleanup)

    const { data, error } = await admin.rpc('complete_payment', {
      p_payment_id: paymentId,
      p_paymongo_data: null,
      p_amount_centavos: 10000,
    })

    expect(error).toBeNull()
    expect(data).toBe(true)

    const { data: booking } = await admin
      .from('bookings')
      .select('current_status')
      .eq('id', bookingId)
      .single()
    expect(booking?.current_status).toBe('approved')
  })

  it('does NOT auto-approve a booking still in the admin queue (pending)', async () => {
    const { paymentId, bookingId, cleanup } = await seedPaidBooking(admin, {
      totalPesos: 100,
      currentStatus: 'pending',
    })
    cleanupFns.push(cleanup)

    const { data, error } = await admin.rpc('complete_payment', {
      p_payment_id: paymentId,
      p_paymongo_data: null,
      p_amount_centavos: 10000,
    })

    expect(error).toBeNull()
    expect(data).toBe(true)

    const { data: booking } = await admin
      .from('bookings')
      .select('current_status')
      .eq('id', bookingId)
      .single()
    expect(booking?.current_status).toBe('pending')
  })

  it('rejects completion on an expired link even with the exact correct amount (webhook/poll path)', async () => {
    const { paymentId, cleanup } = await seedPaidBooking(admin, { totalPesos: 100 })
    cleanupFns.push(cleanup)

    const pastExpiry = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    await admin.from('payments').update({ expires_at: pastExpiry }).eq('id', paymentId)

    const { data, error } = await admin.rpc('complete_payment', {
      p_payment_id: paymentId,
      p_paymongo_data: null,
      p_amount_centavos: 10000, // exact amount owed — still rejected, link is dead
    })

    expect(error).toBeNull()
    expect(data).toBe(false)

    const { data: payment } = await admin
      .from('payments')
      .select('payment_status')
      .eq('id', paymentId)
      .single()
    expect(payment?.payment_status).toBe('pending')

    const { data: auditRows } = await admin
      .from('financial_audit')
      .select('action')
      .eq('payment_id', paymentId)
      .eq('action', 'PAYMENT_LINK_EXPIRED')
    expect(auditRows).toHaveLength(1)
  })
})

describe('POST /api/paymongo/checkout — expired payment link (real DB)', () => {
  it('refuses checkout with 410 when the payment link has expired', async () => {
    const { paymentId, userId, cleanup } = await seedPaidBooking(admin, { totalPesos: 100 })
    cleanupFns.push(cleanup)

    const pastExpiry = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago
    const { error: updateErr } = await admin
      .from('payments')
      .update({ expires_at: pastExpiry })
      .eq('id', paymentId)
    expect(updateErr).toBeNull()

    const { requireAuthenticatedUser } = await import('@/lib/auth/guards')
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      error: null,
      user: {
        id: userId,
        auth_user_id: `auth-${userId}`,
        email: 'tst-checkout@example.com',
        full_name: 'TST Checkout User',
        user_type: 'internal',
        account_status: 'active',
        employee_id: null,
        phone: null,
        avatar_url: null,
        roles: [],
        department: null,
      },
    })

    const { POST } = await import('@/app/api/paymongo/checkout/route')
    const req = new NextRequest('http://localhost:3000/api/paymongo/checkout', {
      method: 'POST',
      body: JSON.stringify({ paymentId }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(410)
    const data = await res.json()
    expect(data.error).toBe('This payment link has expired. Contact the building admin for a new one.')

    // Confirm the fix didn't mutate payment_status as a side effect
    const { data: payment } = await admin
      .from('payments')
      .select('payment_status')
      .eq('id', paymentId)
      .single()
    expect(payment?.payment_status).toBe('pending')
  })
})
