/**
 * Minimum reservation advance-notice ("lead time") shared between the client
 * date-picker (hooks/faculty/useReservationForm) and the server constraint
 * checker (backend/booking/hardConstraintChecker) so the two can never drift.
 * The value itself is set by the building admin and stored in system_settings
 * under the key `min_reservation_lead_days`.
 */

/** Fallback used when the `min_reservation_lead_days` setting row is absent. */
export const DEFAULT_MIN_LEAD_DAYS = 3

/** system_settings key holding the global minimum advance-notice days. */
export const MIN_LEAD_DAYS_KEY = 'min_reservation_lead_days'

/**
 * Earliest date a reservation may be booked, given today (ISO `YYYY-MM-DD`,
 * Manila) and the minimum advance-notice days. Counts forward from tomorrow,
 * skipping Sundays (they don't count toward the notice); Saturdays count.
 * `minDays <= 0` returns today (feature off).
 *
 * Examples (matches the building-admin's stated rule): Thu + 3 → Mon,
 * Sat + 1 → Mon, Fri + 3 → Tue.
 */
export function earliestBookableDate(todayISO: string, minDays: number): string {
  if (minDays <= 0) return todayISO
  // Parse as UTC midnight so getUTCDay()/date math is timezone-independent.
  const d = new Date(`${todayISO}T00:00:00Z`)
  let counted = 0
  while (counted < minDays) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 0) counted++ // 0 = Sunday, doesn't count
  }
  return d.toISOString().slice(0, 10)
}
