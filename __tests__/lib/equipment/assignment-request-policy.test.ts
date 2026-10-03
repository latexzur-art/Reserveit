import { describe, it, expect } from 'vitest'
import {
  nextRequestStatuses,
  isRequestTransitionAllowed,
} from '@/lib/equipment/assignment-request-policy'

describe('nextRequestStatuses', () => {
  it('advances pending -> approved | rejected', () => {
    expect(nextRequestStatuses('pending')).toEqual(['approved', 'rejected'])
  })
  it('advances approved -> in_progress | rejected', () => {
    expect(nextRequestStatuses('approved')).toEqual(['in_progress', 'rejected'])
  })
  it('advances in_progress -> completed | rejected', () => {
    expect(nextRequestStatuses('in_progress')).toEqual(['completed', 'rejected'])
  })
  it('has no transitions out of terminal states', () => {
    expect(nextRequestStatuses('completed')).toEqual([])
    expect(nextRequestStatuses('rejected')).toEqual([])
  })
})

describe('isRequestTransitionAllowed', () => {
  it('allows only adjacent forward transitions', () => {
    expect(isRequestTransitionAllowed('pending', 'approved')).toBe(true)
    expect(isRequestTransitionAllowed('in_progress', 'completed')).toBe(true)
  })
  it('rejects skips and backward moves', () => {
    expect(isRequestTransitionAllowed('pending', 'completed')).toBe(false)
    expect(isRequestTransitionAllowed('completed', 'approved')).toBe(false)
    expect(isRequestTransitionAllowed('approved', 'approved')).toBe(false)
  })
})
