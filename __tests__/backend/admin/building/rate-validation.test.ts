import { describe, it, expect } from 'vitest'
import { validateRateForm, type RateFormValues } from '@/backend/admin/building/rate-validation'

// Baseline valid non-addon form; each test overrides just what it exercises.
function form(overrides: Partial<RateFormValues> = {}): RateFormValues {
  return {
    rateName: 'AM Hourly Rate',
    amount: '500',
    timePeriod: 'am',
    startTime: '',
    endTime: '',
    isAddon: false,
    ...overrides,
  }
}

describe('validateRateForm — required fields', () => {
  it('rejects an empty rate name', () => {
    const r = validateRateForm(form({ rateName: '   ' }))
    expect(r).toEqual({ ok: false, field: 'rateName', message: 'Rate name is required' })
  })

  it('rejects an empty amount', () => {
    const r = validateRateForm(form({ amount: '' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.field).toBe('amount')
  })

  it('rejects a negative amount', () => {
    const r = validateRateForm(form({ amount: '-5' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.field).toBe('amount')
  })

  it('rejects a non-numeric amount', () => {
    const r = validateRateForm(form({ amount: 'abc' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.field).toBe('amount')
  })
})

describe('validateRateForm — add-ons skip the time window', () => {
  it('accepts an add-on regardless of times', () => {
    const r = validateRateForm(form({ isAddon: true, startTime: '08:00', endTime: '07:00' }))
    expect(r).toEqual({ ok: true })
  })
})

describe('validateRateForm — window is optional but paired', () => {
  it('accepts no window at all', () => {
    expect(validateRateForm(form({ startTime: '', endTime: '' }))).toEqual({ ok: true })
  })

  it('rejects a half-set window (start without end)', () => {
    const r = validateRateForm(form({ startTime: '08:00', endTime: '' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.field).toBe('time')
  })
})

describe('validateRateForm — window must fall inside the selected period', () => {
  it('accepts an AM window inside the morning', () => {
    expect(validateRateForm(form({ timePeriod: 'am', startTime: '08:00', endTime: '12:00' }))).toEqual({ ok: true })
  })

  it('rejects an AM window that spills into the afternoon', () => {
    const r = validateRateForm(form({ timePeriod: 'am', startTime: '08:00', endTime: '13:00' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.field).toBe('time')
  })

  it('accepts a PM window inside the afternoon', () => {
    expect(validateRateForm(form({ timePeriod: 'pm', startTime: '13:00', endTime: '18:00' }))).toEqual({ ok: true })
  })

  it('rejects a PM window that starts in the morning', () => {
    const r = validateRateForm(form({ timePeriod: 'pm', startTime: '09:00', endTime: '11:00' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.field).toBe('time')
  })
})

describe('validateRateForm — cross-midnight only for All Day', () => {
  it('accepts an overnight window for All Day', () => {
    expect(validateRateForm(form({ timePeriod: 'all_day', startTime: '17:00', endTime: '07:00' }))).toEqual({ ok: true })
  })

  it('accepts a normal All Day window', () => {
    expect(validateRateForm(form({ timePeriod: 'all_day', startTime: '08:00', endTime: '20:00' }))).toEqual({ ok: true })
  })

  it('rejects an overnight window for an AM rate', () => {
    const r = validateRateForm(form({ timePeriod: 'am', startTime: '17:00', endTime: '07:00' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.field).toBe('time')
  })
})
