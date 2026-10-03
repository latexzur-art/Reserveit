import { describe, it, expect } from 'vitest'
import { canHandleReport } from '@/lib/equipment/report-policy'

describe('canHandleReport', () => {
  it('lets building_admin handle any report (front-line triage)', () => {
    expect(canHandleReport(['building_admin'], false, 'open')).toBe(true)
    expect(canHandleReport(['building_admin'], true, 'open')).toBe(true)
    expect(canHandleReport(['building_admin'], false, 'escalated')).toBe(true)
    expect(canHandleReport(['building_admin'], true, 'escalated')).toBe(true)
  })

  it('lets pamo_officer handle non-tech reports through their in-progress states', () => {
    expect(canHandleReport(['pamo_officer'], false, 'escalated')).toBe(true)
    // must stay handleable once moved off 'escalated', or the office is locked out
    expect(canHandleReport(['pamo_officer'], false, 'under_process')).toBe(true)
    expect(canHandleReport(['pamo_officer'], false, 'still_broken')).toBe(true)
    // pre-escalation and terminal states are not the office's to act on
    expect(canHandleReport(['pamo_officer'], false, 'open')).toBe(false)
    expect(canHandleReport(['pamo_officer'], false, 'resolved')).toBe(false)
    // tech is not PAMO's
    expect(canHandleReport(['pamo_officer'], true, 'escalated')).toBe(false)
  })

  it('lets it_admin handle tech reports through their in-progress states', () => {
    expect(canHandleReport(['it_admin'], true, 'escalated')).toBe(true)
    expect(canHandleReport(['it_admin'], true, 'under_process')).toBe(true)
    expect(canHandleReport(['it_admin'], true, 'still_broken')).toBe(true)
    expect(canHandleReport(['it_admin'], true, 'open')).toBe(false)
    expect(canHandleReport(['it_admin'], true, 'resolved')).toBe(false)
    expect(canHandleReport(['it_admin'], false, 'escalated')).toBe(false)
  })

  it('denies unrelated roles', () => {
    expect(canHandleReport(['faculty'], false, 'escalated')).toBe(false)
    expect(canHandleReport([], true, 'escalated')).toBe(false)
  })

  it('grants access if any held role qualifies', () => {
    expect(canHandleReport(['faculty', 'pamo_officer'], false, 'escalated')).toBe(true)
  })
})
