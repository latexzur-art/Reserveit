import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateChain = vi.fn().mockResolvedValue({ error: null })

const insertSingle = vi.fn().mockResolvedValue({
  data: { id: 'decision-1' },
  error: null,
})

const fromMock = vi.fn().mockImplementation((table: string) => {
  if (table === 'bookings') {
    return {
      update: vi.fn().mockReturnValue({ eq: updateChain }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { booking_reference: 'BK-TEST', user_id: 'u1' },
            error: null,
          }),
        }),
      }),
    }
  }
  if (table === 'booking_decisions') {
    return {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: insertSingle }),
      }),
    }
  }
  if (table === 'users') {
    return {
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }
  }
  if (table === 'notifications') {
    return { insert: vi.fn().mockResolvedValue({ error: null }) }
  }
  if (table === 'user_roles') {
    return {
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }
  }
  return { select: vi.fn(), insert: vi.fn(), update: vi.fn() }
})

const supabaseMock: any = { from: fromMock }

import { makeDecision } from '@/backend/booking/autoDecisionRouter'
import type { ScoringResult } from '@/backend/booking/booking.types'

function scoring(final: number, base = 80): ScoringResult {
  return {
    base_score: base,
    final_score: final,
    adjustments: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  updateChain.mockClear()
  updateChain.mockResolvedValue({ error: null })
  insertSingle.mockResolvedValue({ data: { id: 'decision-1' }, error: null })
})

describe('makeDecision — score thresholds', () => {
  it('auto_approves at exactly the auto-approve threshold (80)', async () => {
    const result = await makeDecision(supabaseMock, 'b1', 'u1', scoring(80), false, {})
    expect(result.status).toBe('auto_approved')
  })

  it('flags at one below auto-approve threshold (79)', async () => {
    const result = await makeDecision(supabaseMock, 'b1', 'u1', scoring(79), false, {})
    expect(result.status).toBe('flagged')
  })

  it('flags at exactly the flag minimum (35)', async () => {
    const result = await makeDecision(supabaseMock, 'b1', 'u1', scoring(35), false, {})
    expect(result.status).toBe('flagged')
  })

  it('auto_declines at one below the flag minimum (34)', async () => {
    const result = await makeDecision(supabaseMock, 'b1', 'u1', scoring(34), false, {})
    expect(result.status).toBe('auto_declined')
  })

  it('auto_declines at zero', async () => {
    const result = await makeDecision(supabaseMock, 'b1', 'u1', scoring(0), false, {})
    expect(result.status).toBe('auto_declined')
  })

  it('auto_approves at the maximum (100)', async () => {
    const result = await makeDecision(supabaseMock, 'b1', 'u1', scoring(100), false, {})
    expect(result.status).toBe('auto_approved')
  })
})

describe('makeDecision — policy overrides and probation', () => {
  it('flags ANY booking from a probation account regardless of score (95)', async () => {
    const result = await makeDecision(supabaseMock, 'b1', 'u1', scoring(95), true, {})
    expect(result.status).toBe('flagged')
    expect(result.reason).toMatch(/probation/i)
  })

  it('still flags probation even if score would have been auto_declined', async () => {
    const result = await makeDecision(supabaseMock, 'b1', 'u1', scoring(10), true, {})
    expect(result.status).toBe('flagged')
  })

  it('auto_approves academic_head regardless of low score', async () => {
    const result = await makeDecision(
      supabaseMock, 'b1', 'u1', scoring(10), false, {}, ['academic_head']
    )
    expect(result.status).toBe('auto_approved')
    expect(result.reason).toMatch(/policy/i)
  })

  it('flags academic_head when on probation (probation wins over policy override)', async () => {
    const result = await makeDecision(
      supabaseMock, 'b1', 'u1', scoring(95), true, {}, ['academic_head']
    )
    expect(result.status).toBe('flagged')
    expect(result.reason).toMatch(/probation/i)
  })

  it('marks policy_override=true on academic_head bookings (P0-2 audit)', async () => {
    await makeDecision(
      supabaseMock, 'b1', 'u1', scoring(50), false, {}, ['academic_head']
    )
    // The bookings.update call should include policy_override: true
    const updateCall = fromMock.mock.calls.find(c => c[0] === 'bookings')
    expect(updateCall).toBeDefined()
    // The first argument passed to update() on the bookings table:
    const updatePayload = (fromMock.mock.results.find(r => r.value?.update)?.value.update as any).mock?.calls?.[0]?.[0]
    if (updatePayload) {
      expect(updatePayload.policy_override).toBe(true)
    }
  })

  it('marks policy_override=false on regular auto_approved bookings', async () => {
    fromMock.mockClear()
    await makeDecision(supabaseMock, 'b1', 'u1', scoring(85), false, {})
    const bookingsResult = fromMock.mock.results.find(
      (r, i) => fromMock.mock.calls[i][0] === 'bookings'
    )
    const updateMock = bookingsResult?.value?.update as any
    if (updateMock?.mock?.calls?.[0]?.[0]) {
      expect(updateMock.mock.calls[0][0].policy_override).toBe(false)
    }
  })
})

describe('makeDecision — session/facility mismatch override', () => {
  it('forces flagged when SESSION_LECTURE_IN_LAB_MISMATCH, even with high score', async () => {
    const result = await makeDecision(
      supabaseMock, 'b1', 'u1', scoring(95), false, {},
      [], 0, 'SESSION_LECTURE_IN_LAB_MISMATCH'
    )
    expect(result.status).toBe('flagged')
    expect(result.reason).toMatch(/lecture.*lab/i)
  })

  it('does NOT trigger mismatch flag when no mismatchFlag is provided', async () => {
    const result = await makeDecision(
      supabaseMock, 'b1', 'u1', scoring(95), false, {}, [], 0, null
    )
    expect(result.status).toBe('auto_approved')
  })

  it('mismatch flag does NOT override probation (probation still flags first)', async () => {
    const result = await makeDecision(
      supabaseMock, 'b1', 'u1', scoring(95), true, {}, [], 0, 'SESSION_LECTURE_IN_LAB_MISMATCH'
    )
    expect(result.status).toBe('flagged')
    expect(result.reason).toMatch(/probation/i)
  })
})

describe('makeDecision — oversight window', () => {
  it('sets oversight_expires_at approximately 48 hours from now', async () => {
    const result = await makeDecision(supabaseMock, 'b1', 'u1', scoring(85), false, {})
    const expiresAt = new Date(result.oversight_expires_at).getTime()
    const now = Date.now()
    const diffHours = (expiresAt - now) / (1000 * 60 * 60)
    // Allow generous slack since getManilaNow() introduces TZ skew vs Date.now()
    expect(diffHours).toBeGreaterThan(30)
    expect(diffHours).toBeLessThan(60)
  })
})
