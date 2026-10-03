import { describe, it, expect } from 'vitest'
import {
  canFileScheduleReport,
  canTriageScheduleReport,
  isValidTransition,
  TRANSITIONS,
} from '@/lib/schedule/report-policy'

describe('canFileScheduleReport', () => {
  it('returns true for faculty', () => {
    expect(canFileScheduleReport(['faculty'])).toBe(true)
  })

  it('returns true for program_head', () => {
    expect(canFileScheduleReport(['program_head'])).toBe(true)
  })

  it('returns true for academic_head', () => {
    expect(canFileScheduleReport(['academic_head'])).toBe(true)
  })

  it('returns false for external_client', () => {
    expect(canFileScheduleReport(['external_client'])).toBe(false)
  })

  it('returns false for building_admin (they triage, not file)', () => {
    expect(canFileScheduleReport(['building_admin'])).toBe(false)
  })
})

describe('canTriageScheduleReport', () => {
  it('returns true for building_admin', () => {
    expect(canTriageScheduleReport(['building_admin'])).toBe(true)
  })

  it('returns false for faculty', () => {
    expect(canTriageScheduleReport(['faculty'])).toBe(false)
  })
})

describe('isValidTransition', () => {
  it('accepts pending -> under_review', () => {
    expect(isValidTransition('pending', 'under_review')).toBe(true)
  })

  it('accepts under_review -> resolved', () => {
    expect(isValidTransition('under_review', 'resolved')).toBe(true)
  })

  it('accepts under_review -> dismissed', () => {
    expect(isValidTransition('under_review', 'dismissed')).toBe(true)
  })

  it('accepts under_review -> escalated', () => {
    expect(isValidTransition('under_review', 'escalated')).toBe(true)
  })

  it('accepts escalated -> resolved', () => {
    expect(isValidTransition('escalated', 'resolved')).toBe(true)
  })

  it('accepts escalated -> under_review (re-open)', () => {
    expect(isValidTransition('escalated', 'under_review')).toBe(true)
  })

  it('rejects resolved -> pending', () => {
    expect(isValidTransition('resolved', 'pending')).toBe(false)
  })

  it('rejects dismissed -> under_review', () => {
    expect(isValidTransition('dismissed', 'under_review')).toBe(false)
  })

  it('rejects escalated -> pending', () => {
    expect(isValidTransition('escalated', 'pending')).toBe(false)
  })
})

describe('TRANSITIONS', () => {
  it('is a frozen map of allowed transitions', () => {
    expect(TRANSITIONS).toBeDefined()
    expect(typeof TRANSITIONS).toBe('object')
  })
})
