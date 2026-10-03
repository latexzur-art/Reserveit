import { describe, it, expect } from 'vitest'
import { checkAdminBlock } from '@/backend/booking/hardConstraintChecker'
import type { BookingContext } from '@/backend/booking/booking.types'

// Captures the timestamp bounds checkAdminBlock hands to Postgres so we can assert
// they're syntactically valid — a stub won't reject malformed syntax the way the
// real facility_blocks query does, so we inspect the args directly.
function stubCapturingArgs() {
  const calls: { method: string; arg: unknown }[] = []
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    lte: (_col: string, val: unknown) => {
      calls.push({ method: 'lte', arg: val })
      return builder
    },
    gte: (_col: string, val: unknown) => {
      calls.push({ method: 'gte', arg: val })
      return builder
    },
    then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
  }
  return { supabase: { from: () => builder } as any, calls }
}

// Postgres `time` columns come back from PostgREST as "HH:MM:SS", not "HH:MM" —
// this is the real shape booking.start_time/end_time have in BookingContext.
const base: BookingContext = {
  facility_id: 'f1',
  booking_date: '2026-08-14',
  start_time: '10:00:00',
  end_time: '12:00:00',
} as BookingContext

describe('checkAdminBlock timestamp construction', () => {
  it('builds a valid ISO 8601 timestamp from HH:MM:SS start/end times', async () => {
    const { supabase, calls } = stubCapturingArgs()
    await checkAdminBlock(supabase, base)

    const lteArg = calls.find((c) => c.method === 'lte')?.arg as string
    const gteArg = calls.find((c) => c.method === 'gte')?.arg as string

    expect(new Date(lteArg).toString()).not.toBe('Invalid Date')
    expect(new Date(gteArg).toString()).not.toBe('Invalid Date')
  })
})
