import { describe, it, expect } from 'vitest'
import { earliestBookableDate } from '@/lib/reservation-lead-time'

// 2026-08-06 is a Thursday; 2026-08-08 a Saturday; 2026-08-07 a Friday.
describe('earliestBookableDate', () => {
  it('Thu + 3 → Mon (Sunday skipped)', () => {
    expect(earliestBookableDate('2026-08-06', 3)).toBe('2026-08-10')
  })

  it('Sat + 1 → Mon (tomorrow is Sunday, does not count)', () => {
    expect(earliestBookableDate('2026-08-08', 1)).toBe('2026-08-10')
  })

  it('Fri + 3 → Tue (Sat counts, Sun skipped)', () => {
    expect(earliestBookableDate('2026-08-07', 3)).toBe('2026-08-11')
  })

  it('minDays 0 → today (feature off)', () => {
    expect(earliestBookableDate('2026-08-06', 0)).toBe('2026-08-06')
  })
})
