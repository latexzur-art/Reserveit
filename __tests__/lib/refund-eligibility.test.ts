import { describe, it, expect } from 'vitest'
import { isRefundWindowMet } from '@/lib/refund-eligibility'

describe('isRefundWindowMet', () => {
  it('is true when the booking is exactly 2 whole days after submission', () => {
    expect(isRefundWindowMet('2026-08-10', '2026-08-08')).toBe(true)
  })

  it('is true when the booking is more than 2 days after submission', () => {
    expect(isRefundWindowMet('2026-08-20', '2026-08-08')).toBe(true)
  })

  it('is false when the booking is only 1 day after submission', () => {
    expect(isRefundWindowMet('2026-08-09', '2026-08-08')).toBe(false)
  })

  it('is false when the booking is the same day as submission', () => {
    expect(isRefundWindowMet('2026-08-08', '2026-08-08')).toBe(false)
  })

  it('is false when the booking date has already passed relative to submission', () => {
    expect(isRefundWindowMet('2026-08-05', '2026-08-08')).toBe(false)
  })

  it('ignores time-of-day components entirely', () => {
    // 8am on the 8th vs 11pm on the 10th — still exactly 2 whole calendar days apart
    expect(isRefundWindowMet('2026-08-10T23:00:00+08:00', '2026-08-08T08:00:00+08:00')).toBe(true)
  })
})
