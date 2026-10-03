/**
 * Integration tests — Gap 8: Extension Child Records Orphaned
 *
 * Verifies that when an extension payment completes via the `complete_payment` RPC,
 * the child extension booking transitions from 'pending' to 'approved'.
 *
 * Before the fix, `complete_payment` only extended the parent's `end_time` but
 * left the child extension booking stuck in 'pending' forever.
 *
 * All test data uses TST_ prefix for easy identification and cleanup.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fetch as undiciFetch } from 'undici'

// Load real credentials — overrides the fake keys set by __tests__/setup.ts
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import { makeAdminClient } from './helpers/seedPaidBooking'

// Only auth is mocked
vi.mock('@/lib/auth/guards', () => ({
  requireAuthenticatedUser: vi.fn(),
}))

global.fetch = undiciFetch as unknown as typeof globalThis.fetch

const admin = makeAdminClient()

let cleanupFns: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const cleanup of cleanupFns) {
    await cleanup()
  }
  cleanupFns = []
})

function futureDate(daysFromNow = 30): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

describe('complete_payment — extension child booking status (real DB)', () => {
  it('transitions child extension booking to approved when extension payment completes', async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`

    // Get a real user
    const { data: users, error: userErr } = await admin.from('users').select('id').limit(1)
    const user = users?.[0]
    if (userErr || !user) throw new Error(`No users found: ${userErr?.message ?? 'empty'}`)
    const userId = user.id as string

    // 1. Create a parent booking (approved, future date)
    const { data: parentBooking, error: parentErr } = await admin
      .from('bookings')
      .insert({
        booking_reference: `TST_EXT_PARENT_${suffix}`,
        user_id: userId,
        booking_type: 'internal_paid',
        booking_purpose: 'personal',
        booking_date: futureDate(10),
        start_time: '09:00',
        end_time: '11:00',
        purpose: 'TST_ parent booking for extension test',
        current_status: 'approved',
        requires_payment: false,
      })
      .select('id')
      .single()

    if (parentErr || !parentBooking) throw new Error(`Failed to seed parent: ${parentErr?.message}`)
    const parentId = parentBooking.id as string

    // 2. Create a child extension booking (pending, referencing parent)
    const { data: childBooking, error: childErr } = await admin
      .from('bookings')
      .insert({
        booking_reference: `TST_EXT_CHILD_${suffix}`,
        user_id: userId,
        booking_type: 'internal_paid',
        booking_purpose: 'personal',
        booking_date: futureDate(10),
        start_time: '11:00',
        end_time: '13:00',
        purpose: 'TST_ extension child booking',
        current_status: 'pending',
        requires_payment: true,
        is_extension: true,
        extension_of_booking_id: parentId,
      })
      .select('id')
      .single()

    if (childErr || !childBooking) {
      await admin.from('bookings').delete().eq('id', parentId)
      throw new Error(`Failed to seed child: ${childErr?.message}`)
    }
    const childId = childBooking.id as string

    // 3. Create an extension payment for the parent booking
    const { data: payment, error: payErr } = await admin
      .from('payments')
      .insert({
        payment_reference: `TST_EXT_PAY_${suffix}`,
        booking_id: parentId,
        user_id: userId,
        amount: 50,
        currency: 'PHP',
        payment_method: 'paymongo_card',
        payment_status: 'pending',
        payment_type: 'extension',
        extension_hours: 2,
      })
      .select('id')
      .single()

    if (payErr || !payment) {
      await admin.from('bookings').delete().eq('id', childId)
      await admin.from('bookings').delete().eq('id', parentId)
      throw new Error(`Failed to seed payment: ${payErr?.message}`)
    }
    const paymentId = payment.id as string

    const cleanup = async () => {
      await admin.from('financial_audit').delete().eq('payment_id', paymentId)
      await admin.from('payments').delete().eq('id', paymentId)
      await admin.from('bookings').delete().eq('id', childId)
      await admin.from('bookings').delete().eq('id', parentId)
    }
    cleanupFns.push(cleanup)

    // 4. Complete the extension payment
    const { data, error } = await admin.rpc('complete_payment', {
      p_payment_id: paymentId,
      p_paymongo_data: null,
      p_amount_centavos: 5000,
    })

    expect(error).toBeNull()
    expect(data).toBe(true)

    // 5. Verify parent's end_time was extended
    const { data: parentAfter } = await admin
      .from('bookings')
      .select('end_time')
      .eq('id', parentId)
      .single()
    // Parent end_time should now be 13:00 (was 11:00 + 2 hours)
    expect(parentAfter?.end_time).toBe('13:00:00')

    // 6. Verify child extension booking is now 'approved' (the fix)
    const { data: childAfter } = await admin
      .from('bookings')
      .select('current_status, approved_at')
      .eq('id', childId)
      .single()

    // This assertion will FAIL before the fix (child stays 'pending')
    // and PASS after the fix (child transitions to 'approved')
    expect(childAfter?.current_status).toBe('approved')
    expect(childAfter?.approved_at).not.toBeNull()
  }, 30000)

  it('does NOT transition child extension bookings with future dates beyond current date guard', async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`

    const { data: users } = await admin.from('users').select('id').limit(1)
    const userId = users![0].id as string

    // Parent booking
    const { data: parentBooking, error: parentErr } = await admin
      .from('bookings')
      .insert({
        booking_reference: `TST_EXT2_PARENT_${suffix}`,
        user_id: userId,
        booking_type: 'internal_paid',
        booking_purpose: 'personal',
        booking_date: futureDate(10),
        start_time: '09:00',
        end_time: '11:00',
        purpose: 'TST_ parent booking for extension test 2',
        current_status: 'approved',
        requires_payment: false,
      })
      .select('id')
      .single()

    if (parentErr || !parentBooking) throw new Error(`Failed: ${parentErr?.message}`)
    const parentId = parentBooking.id as string

    // Child extension with a PAST date (should NOT be transitioned due to date guard)
    const { data: childBooking, error: childErr } = await admin
      .from('bookings')
      .insert({
        booking_reference: `TST_EXT2_CHILD_${suffix}`,
        user_id: userId,
        booking_type: 'internal_paid',
        booking_purpose: 'personal',
        booking_date: '2020-01-01', // past date
        start_time: '11:00',
        end_time: '13:00',
        purpose: 'TST_ extension child booking (past)',
        current_status: 'pending',
        requires_payment: true,
        is_extension: true,
        extension_of_booking_id: parentId,
      })
      .select('id')
      .single()

    if (childErr || !childBooking) {
      await admin.from('bookings').delete().eq('id', parentId)
      throw new Error(`Failed: ${childErr?.message}`)
    }
    const childId = childBooking.id as string

    // Extension payment
    const { data: payment, error: payErr } = await admin
      .from('payments')
      .insert({
        payment_reference: `TST_EXT2_PAY_${suffix}`,
        booking_id: parentId,
        user_id: userId,
        amount: 50,
        currency: 'PHP',
        payment_method: 'paymongo_card',
        payment_status: 'pending',
        payment_type: 'extension',
        extension_hours: 2,
      })
      .select('id')
      .single()

    if (payErr || !payment) {
      await admin.from('bookings').delete().eq('id', childId)
      await admin.from('bookings').delete().eq('id', parentId)
      throw new Error(`Failed: ${payErr?.message}`)
    }
    const paymentId = payment.id as string

    const cleanup = async () => {
      await admin.from('financial_audit').delete().eq('payment_id', paymentId)
      await admin.from('payments').delete().eq('id', paymentId)
      await admin.from('bookings').delete().eq('id', childId)
      await admin.from('bookings').delete().eq('id', parentId)
    }
    cleanupFns.push(cleanup)

    // Complete the extension payment
    const { data, error } = await admin.rpc('complete_payment', {
      p_payment_id: paymentId,
      p_paymongo_data: null,
      p_amount_centavos: 5000,
    })

    expect(error).toBeNull()
    expect(data).toBe(true)

    // Child with past date should remain 'pending' (date guard protects it)
    const { data: childAfter } = await admin
      .from('bookings')
      .select('current_status')
      .eq('id', childId)
      .single()

    expect(childAfter?.current_status).toBe('pending')
  }, 30000)
})
