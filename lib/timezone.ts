/**
 * Timezone utility for Asia/Manila (UTC+8).
 * All date/time calculations in the booking pipeline must use these
 * helpers instead of bare `new Date()` to ensure correct behavior
 * regardless of server timezone (e.g., Vercel defaults to UTC).
 */

const MANILA_TZ = 'Asia/Manila'

/**
 * TZ fix: extract Manila wall-clock components via Intl.DateTimeFormat instead of
 * the old `toLocaleString('en-US', {timeZone}) → new Date(...)` round trip. That
 * round trip re-parses a locale-formatted string through the Date constructor,
 * which is not a robust way to get exact date/time components (locale string
 * format/parsing is not guaranteed stable across runtimes) and was also
 * runtime-timezone-sensitive in a way that only "happened" to cancel out on a
 * UTC-configured runtime — see plan note in
 * plans/booking-pipeline-decision-time-audit.md ("getManilaNow() is a latent
 * timezone footgun").
 */
function getManilaParts(instant: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0)
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: get('hour'), minute: get('minute'), second: get('second'),
  }
}

/**
 * Returns a Date whose UTC-methods (getUTCFullYear, getUTCHours, getUTCDay, ...)
 * reflect the current Asia/Manila wall-clock date/time — deliberately encoded as a
 * "fake UTC" instant so the result is safe to compare/format the same way
 * regardless of the runtime's own local timezone (Vercel=UTC, a Manila-local VPS,
 * or anything else).
 *
 * IMPORTANT: because of this encoding, always read/mutate the result with the
 * UTC-prefixed Date methods (getUTCHours, setUTCHours, getUTCDay, toISOString...),
 * never the local-tz methods (getHours, setHours, getDay) — those are
 * runtime-timezone-dependent and will silently reintroduce the same skew this
 * function exists to avoid.
 */
export function getManilaNow(): Date {
  const { year, month, day, hour, minute, second } = getManilaParts(new Date())
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second))
}

/**
 * Returns today's date string in YYYY-MM-DD format, Manila timezone.
 */
export function getManilaTodayISO(): string {
  return getManilaNow().toISOString().slice(0, 10)
}

/**
 * Formats a Date as an ISO string using Manila timezone offset (+08:00).
 */
export function toManilaISO(date: Date): string {
  const { year, month, day, hour, minute, second } = getManilaParts(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+08:00`
}
