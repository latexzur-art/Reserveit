import type { TimePeriod } from './building.types'

/**
 * Pure validation for the Add/Edit Rate form (building/pricing).
 *
 * Time model (decided 2026-08-11): the Time Period governs pricing; the optional
 * Start/End window narrows WHEN that rate applies and must fall *inside* the
 * chosen period. Overnight (start-after-end) windows only make sense for All Day
 * rates, so they are rejected for AM/PM. Add-ons are flat and carry no window.
 */

export interface RateFormValues {
  rateName: string
  amount: string // raw input string
  timePeriod: TimePeriod
  startTime: string // 'HH:mm' (24h) or ''
  endTime: string // 'HH:mm' (24h) or ''
  isAddon: boolean
}

export type RateFormField = 'rateName' | 'amount' | 'time'

export type RateValidationResult =
  | { ok: true }
  | { ok: false; field: RateFormField; message: string }

// Period bounds in minutes-from-midnight. Upper bound is the exclusive edge
// (noon = 720 for AM, midnight = 1440 for PM), so a window may end exactly at it.
const PERIOD_BOUNDS: Record<Exclude<TimePeriod, 'all_day'>, { min: number; maxEnd: number }> = {
  am: { min: 0, maxEnd: 720 }, // 12:00 AM – 12:00 noon
  pm: { min: 720, maxEnd: 1440 }, // 12:00 noon – 12:00 midnight
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function periodLabel(p: Exclude<TimePeriod, 'all_day'>): string {
  return p === 'am' ? 'AM (12:00 AM – 12:00 noon)' : 'PM (12:00 noon – 12:00 midnight)'
}

export function validateRateForm(v: RateFormValues): RateValidationResult {
  if (!v.rateName.trim()) {
    return { ok: false, field: 'rateName', message: 'Rate name is required' }
  }

  const amt = parseFloat(v.amount)
  if (v.amount.trim() === '' || isNaN(amt) || amt < 0) {
    return { ok: false, field: 'amount', message: 'Enter a valid amount' }
  }

  // Add-ons are flat — no applicable time window.
  if (v.isAddon) return { ok: true }

  const hasStart = v.startTime.trim() !== ''
  const hasEnd = v.endTime.trim() !== ''
  if (hasStart !== hasEnd) {
    return { ok: false, field: 'time', message: 'Set both start and end time, or leave both empty.' }
  }
  if (!hasStart) return { ok: true } // window is optional

  const start = toMinutes(v.startTime)
  const end = toMinutes(v.endTime)
  if (start == null || end == null) {
    return { ok: false, field: 'time', message: 'Enter a valid time window.' }
  }

  const crossesMidnight = end <= start
  if (crossesMidnight && v.timePeriod !== 'all_day') {
    return {
      ok: false,
      field: 'time',
      message: 'An overnight window (start after end) is only allowed for All Day rates.',
    }
  }

  if (v.timePeriod !== 'all_day') {
    const { min, maxEnd } = PERIOD_BOUNDS[v.timePeriod]
    if (start < min || start >= maxEnd || end <= min || end > maxEnd) {
      return {
        ok: false,
        field: 'time',
        message: `The window must fall within ${periodLabel(v.timePeriod)}.`,
      }
    }
  }

  return { ok: true }
}
