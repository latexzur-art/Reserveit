/**
 * Returns today's date in YYYY-MM-DD format using Manila (Asia/Manila) timezone.
 * Use this instead of `new Date().toISOString()` when passing the current date
 * to `isRefundWindowMet` — UTC dates are wrong between midnight and 8 AM Manila
 * time because UTC is still on the previous calendar day.
 */
export function getManilaDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

/**
 * Whole-day, institution-local-calendar comparison — time of day never
 * matters (locked policy decision, see 2026-08-11-qr-manual-payments-design.md).
 * Callers pass calendar-date strings (YYYY-MM-DD, optionally with a time
 * component which is stripped) already in institution-local terms.
 */
export function isRefundWindowMet(bookingDateISO: string, submittedAtISO: string): boolean {
  const bookingDate = bookingDateISO.slice(0, 10)
  const submittedDate = submittedAtISO.slice(0, 10)

  const booking = Date.UTC(
    Number(bookingDate.slice(0, 4)),
    Number(bookingDate.slice(5, 7)) - 1,
    Number(bookingDate.slice(8, 10)),
  )
  const submitted = Date.UTC(
    Number(submittedDate.slice(0, 4)),
    Number(submittedDate.slice(5, 7)) - 1,
    Number(submittedDate.slice(8, 10)),
  )

  const wholeDaysApart = Math.floor((booking - submitted) / (24 * 60 * 60 * 1000))
  return wholeDaysApart >= 2
}
