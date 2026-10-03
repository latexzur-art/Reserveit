import { describe, it, expect, beforeEach } from 'vitest'
import { calculateScore } from '@/backend/booking/softScoringEngine'
import { cacheSet, TTL_12H, TTL_24H } from '@/lib/cache'
import type { BookingContext } from '@/backend/booking/booking.types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Verifies session-type context flows end-to-end into the scoring pipeline:
 * form → booking context → buildScoringContext → SESSION_* rule evaluation.
 */

type Resp = { data: unknown; error: null; count?: number | null }

function mockSupabase(responses: Record<string, Resp[]>): SupabaseClient {
  const queues: Record<string, Resp[]> = JSON.parse(JSON.stringify(responses))
  function builder(table: string) {
    const next = () => queues[table]?.shift() ?? { data: null, error: null, count: 0 }
    const b: Record<string, unknown> = {}
    const chain = () => b
    for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'is']) b[m] = chain
    b.single = () => Promise.resolve(next())
    b.maybeSingle = () => Promise.resolve(next())
    // awaiting the builder directly (no single/maybeSingle)
    b.then = (resolve: (v: Resp) => unknown) => Promise.resolve(next()).then(resolve)
    return b
  }
  return { from: (table: string) => builder(table) } as unknown as SupabaseClient
}

const baseBooking: BookingContext = {
  user_id: 'u-1',
  user_type: 'internal',
  user_roles: ['faculty'],
  facility_id: 'f-1',
  booking_date: '2099-01-15',
  start_time: '09:00',
  end_time: '11:00',
  booking_purpose: 'class',
  purpose: 'short',
  event_name: null,
  equipment_ids: [],
  user_department_code: 'IT',
  user_department_id: 'd-1',
  booking_course_code: 'CS101',
  booking_department_code: 'IT',
  session_type: 'lab',
  mismatch_justification: null,
} as unknown as BookingContext

beforeEach(() => {
  // Pre-seed module caches so the test controls rules + term deterministically
  cacheSet('booking:active_term', null, TTL_12H)
  cacheSet(
    'booking:soft_rules',
    [
      {
        code: 'SESSION_LAB_IN_LECTURE',
        name: 'Lab session in lecture room',
        point_value: -20,
        condition_field: 'session_facility_match',
        condition_operator: 'equals',
        condition_value: 'lab_in_lecture',
      },
    ],
    TTL_24H,
  )
})

describe('softScoringEngine session-type pipeline', () => {
  it('flags lab session booked into a non-lab facility (SESSION_LAB_IN_LECTURE)', async () => {
    const supabase = mockSupabase({
      bookings: [{ data: [], error: null }],
      restriction_logs: [
        { data: null, error: null }, // last reset
        { data: null, error: null, count: 0 }, // violation count
      ],
      payments: [{ data: [], error: null }],
      facilities: [{ data: { facility_tier: 'standard', facility_types: { name: 'lecture room' } }, error: null }],
      courses: [{ data: { delivery_mode: 'both' }, error: null }],
      // 1st call: session match check (no lab tags) · 2nd: course affinity
      facility_purpose_tags: [
        { data: [], error: null },
        { data: [], error: null },
      ],
    })

    const result = await calculateScore(supabase, baseBooking)
    const codes = result.adjustments.map(a => a.code)
    expect(codes).toContain('SESSION_LAB_IN_LECTURE')
    const adj = result.adjustments.find(a => a.code === 'SESSION_LAB_IN_LECTURE')!
    expect(adj.points).toBe(-20)
  })

  it('does not flag when the facility has a lab tag (correct match for "both" course)', async () => {
    const supabase = mockSupabase({
      bookings: [{ data: [], error: null }],
      restriction_logs: [
        { data: null, error: null },
        { data: null, error: null, count: 0 },
      ],
      payments: [{ data: [], error: null }],
      facilities: [{ data: { facility_tier: 'standard', facility_types: { name: 'laboratory' } }, error: null }],
      courses: [{ data: { delivery_mode: 'both' }, error: null }],
      facility_purpose_tags: [
        { data: [{ tag: 'computer_use' }], error: null },
        { data: [{ tag: 'computer_use' }], error: null },
      ],
      course_facility_affinity: [{ data: null, error: null }],
    })

    const result = await calculateScore(supabase, baseBooking)
    const codes = result.adjustments.map(a => a.code)
    expect(codes).not.toContain('SESSION_LAB_IN_LECTURE')
  })
})
