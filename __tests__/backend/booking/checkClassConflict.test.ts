import { describe, it, expect } from 'vitest'
import { checkClassConflict } from '@/backend/booking/hardConstraintChecker'
import type { BookingContext } from '@/backend/booking/booking.types'

// Minimal chainable supabase stub. Each query builder is thenable and resolves
// to a per-table result. Enough to exercise checkClassConflict's two queries.
function stub(byTable: Record<string, { data: unknown; error?: unknown }>) {
  const builder = (table: string): any => {
    const res = byTable[table] ?? { data: [], error: null }
    const b: any = {
      select: () => b, eq: () => b, lte: () => b, gte: () => b, in: () => b,
      then: (resolve: (v: unknown) => void) => resolve(res),
    }
    return b
  }
  return { from: (t: string) => builder(t) } as any
}

// 2026-06-22 is a Monday → getDay() === 1
const base: BookingContext = {
  facility_id: 'f1',
  booking_date: '2026-06-22',
  start_time: '10:00',
  end_time: '11:00',
} as BookingContext

describe('checkClassConflict day_of_week scalar', () => {
  it('fails when a class recurs on the same weekday', async () => {
    const s = stub({
      class_schedules: { data: [{ id: 'c1', day_of_week: 1, session_type: null }], error: null },
      class_schedule_exceptions: { data: [], error: null },
    })
    expect((await checkClassConflict(s, base)).passed).toBe(false)
  })

  it('passes when the class is on a different weekday', async () => {
    const s = stub({
      class_schedules: { data: [{ id: 'c1', day_of_week: 3, session_type: null }], error: null },
      class_schedule_exceptions: { data: [], error: null },
    })
    expect((await checkClassConflict(s, base)).passed).toBe(true)
  })

  it('lecture schedule does not block a lab booking', async () => {
    const s = stub({
      class_schedules: { data: [{ id: 'c1', day_of_week: 1, session_type: 'lecture' }], error: null },
      class_schedule_exceptions: { data: [], error: null },
    })
    expect((await checkClassConflict(s, { ...base, session_type: 'lab' })).passed).toBe(true)
  })
})
