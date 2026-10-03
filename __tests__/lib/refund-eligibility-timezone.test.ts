import { describe, it, expect, vi, afterEach } from 'vitest'
import { getManilaDateString, isRefundWindowMet } from '@/lib/refund-eligibility'

describe('getManilaDateString', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns Manila date when UTC is still the previous day (midnight-8am Manila)', () => {
    // 2026-08-14 01:00 Manila = 2026-08-13 17:00 UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T17:00:00Z'))

    const result = getManilaDateString()
    expect(result).toBe('2026-08-14')
  })

  it('returns correct Manila date at UTC midnight (8am Manila)', () => {
    // 2026-08-14 08:00 Manila = 2026-08-14 00:00 UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T00:00:00Z'))

    const result = getManilaDateString()
    expect(result).toBe('2026-08-14')
  })

  it('returns same date when UTC and Manila are on the same calendar day', () => {
    // 2026-08-14 12:00 Manila = 2026-08-14 04:00 UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T04:00:00Z'))

    const result = getManilaDateString()
    expect(result).toBe('2026-08-14')
  })

  it('returns YYYY-MM-DD format', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-31T20:00:00Z')) // Jan 1 04:00 Manila

    const result = getManilaDateString()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toBe('2027-01-01')
  })
})

describe('isRefundWindowMet with Manila timezone', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses Manila date correctly across the midnight boundary', () => {
    // Scenario: Booking is 2026-08-16. At UTC 2026-08-13T17:00 (Manila 2026-08-14 01:00),
    // the booking is 2 whole Manila-days away → refund window should be met.
    // But if we used UTC date (2026-08-13), it would be 3 days → still met but for wrong reason.
    // The real bug is when UTC date is one day behind, making the window appear larger than it is.
    //
    // More critical case: Booking is 2026-08-15. At UTC 2026-08-13T17:00 (Manila 2026-08-14 01:00),
    // using Manila date (Aug 14): 1 day apart → NOT met (correct)
    // using UTC date (Aug 13): 2 days apart → met (WRONG — this is the bug)

    // The function itself only compares date strings, so we test the integration:
    // getManilaDateString() + isRefundWindowMet()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T17:00:00Z')) // Manila: 2026-08-14 01:00

    const manilaDate = getManilaDateString()
    expect(manilaDate).toBe('2026-08-14')

    // Booking on Aug 16: 2 days from Aug 14 → met
    expect(isRefundWindowMet('2026-08-16', manilaDate)).toBe(true)

    // Booking on Aug 15: 1 day from Aug 14 → NOT met
    // This is the critical case — with UTC date (Aug 13), it would incorrectly be met
    expect(isRefundWindowMet('2026-08-15', manilaDate)).toBe(false)
  })

  it('correctly handles end-of-month boundary in Manila timezone', () => {
    // 2026-08-01 02:00 Manila = 2026-07-31 18:00 UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-31T18:00:00Z'))

    const manilaDate = getManilaDateString()
    expect(manilaDate).toBe('2026-08-01')

    // Booking on Aug 3: 2 days from Aug 1 → met
    expect(isRefundWindowMet('2026-08-03', manilaDate)).toBe(true)

    // Booking on Aug 2: 1 day from Aug 1 → NOT met
    expect(isRefundWindowMet('2026-08-02', manilaDate)).toBe(false)
  })
})
