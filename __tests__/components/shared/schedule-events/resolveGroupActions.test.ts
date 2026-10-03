import { describe, it, expect } from 'vitest'
import { resolveGroupActions } from '@/components/shared/schedule-events/resolveGroupActions'

const BA = 'building_admin' as const
const AH = 'academic_head' as const

function group(overrides: Partial<{ group_id: string | null; current_status: string; created_by_id?: string }>) {
  return { group_id: 'g1', current_status: 'auto_approved', created_by_id: 'ah-1', ...overrides }
}

describe('resolveGroupActions — grouped AH/BA rows (spec §7 matrix)', () => {
  it('BA viewing pending -> Approve, Reject', () => {
    expect(resolveGroupActions(group({ current_status: 'pending' }), BA, 'ba-1').actions).toEqual(['approve', 'reject'])
  })

  it('AH viewing their own pending -> Withdraw only, with an awaiting-approval message', () => {
    const r = resolveGroupActions(group({ current_status: 'pending', created_by_id: 'ah-1' }), AH, 'ah-1')
    expect(r.actions).toEqual(['withdraw'])
    expect(r.readOnlyMessage).toMatch(/awaiting building admin approval/i)
  })

  it('AH viewing someone else\'s pending -> fully read-only, no actions', () => {
    const r = resolveGroupActions(group({ current_status: 'pending', created_by_id: 'other-ah' }), AH, 'ah-1')
    expect(r.actions).toEqual([])
  })

  it('BA viewing auto_approved -> Cancel (immediate)', () => {
    expect(resolveGroupActions(group({ current_status: 'auto_approved' }), BA, 'ba-1').actions).toEqual(['cancel'])
  })

  it('AH viewing auto_approved -> Request Cancellation (not Cancel)', () => {
    expect(resolveGroupActions(group({ current_status: 'auto_approved' }), AH, 'ah-1').actions).toEqual(['request_cancellation'])
  })

  it('BA viewing cancellation_requested -> Confirm Cancellation, Decline', () => {
    expect(resolveGroupActions(group({ current_status: 'cancellation_requested' }), BA, 'ba-1').actions).toEqual([
      'confirm_cancellation',
      'decline_cancellation',
    ])
  })

  it('AH viewing their own cancellation_requested -> read-only "Awaiting Building Admin confirmation"', () => {
    const r = resolveGroupActions(group({ current_status: 'cancellation_requested', created_by_id: 'ah-1' }), AH, 'ah-1')
    expect(r.actions).toEqual([])
    expect(r.readOnlyMessage).toMatch(/awaiting building admin confirmation/i)
  })

  it('cancelled/completed groups have no actions for either role', () => {
    expect(resolveGroupActions(group({ current_status: 'cancelled' }), BA, 'ba-1').actions).toEqual([])
    expect(resolveGroupActions(group({ current_status: 'completed' }), AH, 'ah-1').actions).toEqual([])
  })
})

describe('resolveGroupActions — ungrouped legacy (Program-Head-submitted) rows, unchanged', () => {
  it('pending -> legacy approve/reject, for either role', () => {
    expect(resolveGroupActions(group({ group_id: null, current_status: 'pending' }), BA, 'ba-1').actions).toEqual([
      'legacy_approve',
      'legacy_reject',
    ])
    expect(resolveGroupActions(group({ group_id: null, current_status: 'pending' }), AH, 'ah-1').actions).toEqual([
      'legacy_approve',
      'legacy_reject',
    ])
  })

  it('auto_approved -> legacy cancel + legacy delete, for either role', () => {
    expect(resolveGroupActions(group({ group_id: null, current_status: 'auto_approved' }), BA, 'ba-1').actions).toEqual([
      'legacy_cancel',
      'legacy_delete',
    ])
  })
})
