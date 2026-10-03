/**
 * Seed helper — Paid booking + pending payment (real DB)
 *
 * Creates a minimal `TST_`-prefixed booking + matching payment row so tests can
 * exercise the `complete_payment` RPC against the real dev Supabase DB without
 * duplicating the boilerplate in every integration test.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetch as undiciFetch } from 'undici'

export function makeAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || key === 'test-service-role-key') {
    throw new Error('Real Supabase credentials not loaded — check .env.local')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: undiciFetch as unknown as typeof globalThis.fetch },
  })
}

export interface SeedPaidBookingOptions {
  totalPesos: number
  currentStatus?: string
}

export interface SeedPaidBookingResult {
  bookingId: string
  paymentId: string
  userId: string
  cleanup: () => Promise<void>
}

function futureDate(daysFromNow = 30): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

export async function seedPaidBooking(
  admin: SupabaseClient,
  { totalPesos, currentStatus = 'pending_user_response' }: SeedPaidBookingOptions,
): Promise<SeedPaidBookingResult> {
  const { data: users, error: userErr } = await admin.from('users').select('id').limit(1)
  const user = users?.[0]
  if (userErr || !user) throw new Error(`No users found in DB: ${userErr?.message ?? 'empty result'}`)
  const userId = user.id as string

  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`
  const bookingReference = `TST_BK_${suffix}`
  const paymentReference = `TST_PAY_${suffix}`

  const { data: booking, error: bookingErr } = await admin
    .from('bookings')
    .insert({
      booking_reference: bookingReference,
      user_id: userId,
      booking_type: 'internal_paid',
      booking_purpose: 'personal',
      booking_date: futureDate(),
      start_time: '09:00',
      end_time: '11:00',
      purpose: 'TST_ integration test booking',
      current_status: currentStatus,
      requires_payment: true,
    })
    .select('id')
    .single()

  if (bookingErr || !booking) throw new Error(`Failed to seed booking: ${bookingErr?.message}`)
  const bookingId = booking.id as string

  const { data: payment, error: paymentErr } = await admin
    .from('payments')
    .insert({
      payment_reference: paymentReference,
      booking_id: bookingId,
      user_id: userId,
      amount: totalPesos,
      currency: 'PHP',
      payment_method: 'paymongo_card',
      payment_status: 'pending',
    })
    .select('id')
    .single()

  if (paymentErr || !payment) {
    // Roll back the booking if the payment insert failed so we don't leak rows.
    await admin.from('bookings').delete().eq('id', bookingId)
    throw new Error(`Failed to seed payment: ${paymentErr?.message}`)
  }
  const paymentId = payment.id as string

  const cleanup = async () => {
    await admin.from('financial_audit').delete().eq('payment_id', paymentId)
    await admin.from('session_credits').delete().eq('applied_to_payment_id', paymentId)
    await admin.from('payments').delete().eq('id', paymentId)
    await admin.from('bookings').delete().eq('id', bookingId)
  }

  return { bookingId, paymentId, userId, cleanup }
}
