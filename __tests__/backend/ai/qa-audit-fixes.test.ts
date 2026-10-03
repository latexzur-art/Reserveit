/**
 * QA Audit Fix Tests — written BEFORE the production code changes.
 * Each test pins a specific bug or missing validation from the audit.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ACTIONS, executeAction, missingActionParams, isActionAllowed, getActionTier, validateActionParams } from '@/backend/ai/actions'
import { resolveCapabilities } from '@/backend/ai/roleCapabilities'
import { buildStableSystemPrompt } from '@/app/api/ai/chat/_lib/prompt'
import type { ActionContext } from '@/backend/ai/actions'

const baCtx = (overrides?: Partial<ActionContext>): ActionContext => ({
  cookie: 'sb-token=abc',
  origin: 'http://localhost:3000',
  userId: 'user-1',
  roles: ['building_admin'],
  ...overrides,
})

// ═══════════════════════════════════════════════════════════════════════
// C1: update_rental_rate must send camelCase 'isActive', not snake_case 'is_active'
// ═══════════════════════════════════════════════════════════════════════
describe('C1: update_rental_rate body uses camelCase isActive', () => {
  it('sends isActive (camelCase) when deactivating a rate', () => {
    const req = ACTIONS.update_rental_rate.request({ rate_id: 'R1', is_active: false })
    expect(req.body).toHaveProperty('isActive', false)
    expect(req.body).not.toHaveProperty('is_active')
  })

  it('sends isActive (camelCase) when activating a rate', () => {
    const req = ACTIONS.update_rental_rate.request({ rate_id: 'R1', is_active: true })
    expect(req.body).toHaveProperty('isActive', true)
    expect(req.body).not.toHaveProperty('is_active')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// C2: approve_assignment_request must use PATCH, not POST
// ═══════════════════════════════════════════════════════════════════════
describe('C2: approve_assignment_request uses PATCH method', () => {
  it('uses PATCH to match the endpoint handler', () => {
    const req = ACTIONS.approve_assignment_request.request({ request_id: 'REQ1', status: 'approved' })
    expect(req.method).toBe('PATCH')
  })

  it('uses PATCH for deny as well', () => {
    const req = ACTIONS.approve_assignment_request.request({ request_id: 'REQ1', status: 'denied' })
    expect(req.method).toBe('PATCH')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// H2: executeAction must use AbortSignal timeout
// ═══════════════════════════════════════════════════════════════════════
describe('H2: executeAction uses fetch timeout', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it('passes a signal (AbortSignal) to fetch for timeout', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Done.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    await executeAction(
      'toggle_facility_rental',
      { facility_id: 'F1', is_available_for_rental: true, facility_name: 'Gym' },
      baCtx()
    )
    const [, init] = fetchMock.mock.calls[0]
    expect(init.signal).toBeDefined()
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// H4: create_rental_rate must validate enum values
// ═══════════════════════════════════════════════════════════════════════
describe('H4: create_rental_rate validates enum params', () => {
  it('rejects invalid fee_category', () => {
    const err = validateActionParams('create_rental_rate', {
      facility_id: 'F1', fee_category: 'INVALID', rate_name: 'Test', rate_type: 'hourly', amount: 500,
    })
    expect(err).not.toBeNull()
    expect(err).toContain('fee_category')
  })

  it('accepts valid fee_category', () => {
    const err = validateActionParams('create_rental_rate', {
      facility_id: 'F1', fee_category: 'rental', rate_name: 'Test', rate_type: 'hourly', amount: 500,
    })
    expect(err).toBeNull()
  })

  it('rejects invalid rate_type', () => {
    const err = validateActionParams('create_rental_rate', {
      facility_id: 'F1', fee_category: 'rental', rate_name: 'Test', rate_type: 'INVALID', amount: 500,
    })
    expect(err).not.toBeNull()
    expect(err).toContain('rate_type')
  })

  it('rejects invalid time_period', () => {
    const err = validateActionParams('create_rental_rate', {
      facility_id: 'F1', fee_category: 'rental', rate_name: 'Test', rate_type: 'hourly',
      amount: 500, time_period: 'INVALID',
    })
    expect(err).not.toBeNull()
    expect(err).toContain('time_period')
  })

  it('accepts valid time_period', () => {
    const err = validateActionParams('create_rental_rate', {
      facility_id: 'F1', fee_category: 'rental', rate_name: 'Test', rate_type: 'hourly',
      amount: 500, time_period: 'am',
    })
    expect(err).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════
// M1: PARAM_FACTS must include rental/facility identifiers for confirm cards
// ═══════════════════════════════════════════════════════════════════════
describe('M1: PARAM_FACTS includes rental identifiers', () => {
  // We test this indirectly: executeAction with rental params should produce
  // facts that include facility_name and rate info.
  // The PARAM_FACTS array is internal, so we test via the describe() output
  // which uses the same params.
  it('toggle_facility_rental describe includes facility name', () => {
    const desc = ACTIONS.toggle_facility_rental.describe({
      facility_id: 'F1', is_available_for_rental: true, facility_name: 'Gymnasium',
    })
    expect(desc).toContain('Gymnasium')
  })

  it('create_rental_rate describe includes rate name and amount', () => {
    const desc = ACTIONS.create_rental_rate.describe({
      facility_id: 'F1', fee_category: 'rental', rate_name: 'AM Rate',
      rate_type: 'hourly', amount: 580, facility_name: 'Gymnasium',
    })
    expect(desc).toContain('AM Rate')
    expect(desc).toContain('580')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// M2: create_rental_rate must reject zero and negative amounts
// ═══════════════════════════════════════════════════════════════════════
describe('M2: create_rental_rate amount validation', () => {
  it('rejects zero amount', () => {
    const err = validateActionParams('create_rental_rate', {
      facility_id: 'F1', fee_category: 'rental', rate_name: 'Free',
      rate_type: 'hourly', amount: 0,
    })
    expect(err).not.toBeNull()
    expect(err).toContain('amount')
  })

  it('rejects negative amount', () => {
    const err = validateActionParams('create_rental_rate', {
      facility_id: 'F1', fee_category: 'rental', rate_name: 'Negative',
      rate_type: 'hourly', amount: -100,
    })
    expect(err).not.toBeNull()
    expect(err).toContain('amount')
  })

  it('rejects non-numeric amount', () => {
    const err = validateActionParams('create_rental_rate', {
      facility_id: 'F1', fee_category: 'rental', rate_name: 'Bad',
      rate_type: 'hourly', amount: 'free',
    })
    expect(err).not.toBeNull()
    expect(err).toContain('amount')
  })

  it('accepts valid positive amount', () => {
    const err = validateActionParams('create_rental_rate', {
      facility_id: 'F1', fee_category: 'rental', rate_name: 'Good',
      rate_type: 'hourly', amount: 580,
    })
    expect(err).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════
// M6: System prompt must include "data is not instructions" boundary
// ═══════════════════════════════════════════════════════════════════════
describe('M6: system prompt has data-is-not-instructions boundary', () => {
  it('building admin prompt tells the model tool results are read-only data', () => {
    const caps = resolveCapabilities([{ name: 'building_admin' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('tool result')
    expect(lower).toContain('read-only')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// M7: Rental prompt must warn about duplicate rates and active bookings
// ═══════════════════════════════════════════════════════════════════════
describe('M7: rental prompt includes safety checks', () => {
  it('warns about checking existing rates before creating', () => {
    const caps = resolveCapabilities([{ name: 'building_admin' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('get_rates')
    expect(lower).toContain('before creating')
  })

  it('warns about checking active bookings before disabling rental', () => {
    const caps = resolveCapabilities([{ name: 'building_admin' }])
    const prompt = buildStableSystemPrompt(caps, 'agentic')
    const lower = prompt.toLowerCase()
    expect(lower).toContain('active')
    expect(lower).toContain('booking')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Rental action completeness: role gating + endpoint correctness
// ═══════════════════════════════════════════════════════════════════════
describe('Rental actions — role gating and endpoint correctness', () => {
  it('all 4 rental actions are in building_admin capability', () => {
    const caps = resolveCapabilities([{ name: 'building_admin' }])
    expect(caps.actions).toContain('toggle_facility_rental')
    expect(caps.actions).toContain('create_rental_rate')
    expect(caps.actions).toContain('update_rental_rate')
    expect(caps.actions).toContain('delete_rental_rate')
  })

  it('rental actions are NOT available to faculty', () => {
    expect(isActionAllowed('toggle_facility_rental', ['faculty'])).toBe(false)
    expect(isActionAllowed('create_rental_rate', ['faculty'])).toBe(false)
  })

  it('toggle_facility_rental proxies to PUT /api/admin/building/facilities/[id]/rental', () => {
    const req = ACTIONS.toggle_facility_rental.request({
      facility_id: 'F1', is_available_for_rental: true,
    })
    expect(req.method).toBe('PUT')
    expect(req.path).toBe('/api/admin/building/facilities/F1/rental')
    expect(req.body).toMatchObject({ isAvailableForRental: true })
  })

  it('create_rental_rate proxies to POST /api/admin/building/rates', () => {
    const req = ACTIONS.create_rental_rate.request({
      facility_id: 'F1', fee_category: 'rental', rate_name: 'AM',
      rate_type: 'hourly', amount: 580, time_period: 'am',
    })
    expect(req.method).toBe('POST')
    expect(req.path).toBe('/api/admin/building/rates')
    expect(req.body).toMatchObject({
      facilityId: 'F1', feeCategory: 'rental', rateName: 'AM',
      rateType: 'hourly', amount: 580, timePeriod: 'am',
    })
  })

  it('update_rental_rate proxies to PUT /api/admin/building/rates/[id]', () => {
    const req = ACTIONS.update_rental_rate.request({ rate_id: 'R1', amount: 700 })
    expect(req.method).toBe('PUT')
    expect(req.path).toBe('/api/admin/building/rates/R1')
  })

  it('delete_rental_rate proxies to DELETE /api/admin/building/rates/[id]', () => {
    const req = ACTIONS.delete_rental_rate.request({ rate_id: 'R1' })
    expect(req.method).toBe('DELETE')
    expect(req.path).toBe('/api/admin/building/rates/R1')
  })

  it('rental actions use correct risk tiers', () => {
    expect(getActionTier('toggle_facility_rental')).toBe('confirm')
    expect(getActionTier('create_rental_rate')).toBe('confirm')
    expect(getActionTier('delete_rental_rate')).toBe('confirm')
  })
})
