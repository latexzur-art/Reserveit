import { describe, it, expect } from 'vitest'
import {
  buildStableSystemPrompt,
  buildVolatileContext,
} from '@/app/api/ai/chat/_lib/prompt'
import { ROLE_CAPABILITIES } from '@/backend/ai/roleCapabilities'
import { EMPTY_FIELDS } from '@/app/api/ai/chat/_lib/shared'

const emptyRates = { configured: [], unconfigured: [] }
const academic = ROLE_CAPABILITIES.academic_head
const itAdmin = ROLE_CAPABILITIES.it_admin

describe('buildStableSystemPrompt (cacheable prefix)', () => {
  it('contains NO volatile data — no concrete date, no current-time, no collected-fields dump', () => {
    const stable = buildStableSystemPrompt(academic, 'agentic')
    // The whole point of the cache fix: nothing that changes per request may live here.
    expect(stable).not.toMatch(/\d{4}-\d{2}-\d{2}/) // no ISO date baked in
    expect(stable).not.toContain('CURRENT TIME')
    expect(stable).not.toContain('CURRENT COLLECTED FIELDS')
    expect(stable).not.toContain('PRE-EXTRACTED')
  })

  it('is byte-identical across calls (no per-call timestamps leak in)', () => {
    const a = buildStableSystemPrompt(academic, 'agentic')
    const b = buildStableSystemPrompt(academic, 'agentic')
    expect(a).toBe(b)
  })

  it('still carries the role persona, a destination, and a guarded action', () => {
    const stable = buildStableSystemPrompt(academic, 'agentic')
    expect(stable).toContain(academic.persona)
    expect(stable).toContain('approve_booking')
    expect(stable).toContain(academic.destinations[0].label)
  })

  it('introduces the assistant by name (Rita)', () => {
    expect(buildStableSystemPrompt(academic, 'agentic')).toContain('Rita')
    expect(buildStableSystemPrompt(itAdmin, 'agentic')).toContain('Rita')
  })

  it('omits the booking rulebook for a non-booking role', () => {
    const stable = buildStableSystemPrompt(itAdmin, 'agentic')
    expect(stable).not.toContain('STANDARD BOOKING HARD CONSTRAINTS')
  })

  it('contains a scope boundary that restricts Rita to ReserveIT operations', () => {
    const stable = buildStableSystemPrompt(academic, 'agentic')
    expect(stable).toContain('SCOPE BOUNDARY')
    expect(stable).toContain('ReserveIT')
  })

  it('includes a refusal instruction for out-of-scope requests', () => {
    const stable = buildStableSystemPrompt(academic, 'agentic')
    expect(stable).toMatch(/REFUSE|refuse/i)
    expect(stable).toMatch(/outside.*(scope|ReserveIT)|only.*(help|assist).*(ReserveIT|facility|booking|schedule)/i)
  })

  it('scope boundary is present for every role, not just booking roles', () => {
    for (const roleKey of Object.keys(ROLE_CAPABILITIES)) {
      const caps = ROLE_CAPABILITIES[roleKey]
      const prompt = buildStableSystemPrompt(caps, 'agentic')
      expect(prompt).toContain('SCOPE BOUNDARY')
    }
  })
})

describe('buildVolatileContext (trailing suffix)', () => {
  const fixedNow = new Date('2026-08-07T14:30:00+08:00')

  const base = {
    facilityContext: '',
    coursesContext: '',
    bookingsMemory: '',
    collectedFields: { ...EMPTY_FIELDS, booking_purpose: 'academic' as string | null },
    bookingFlow: 'standard' as const,
    speculativeFields: { expected_attendees: 42 },
    paidRatesResult: emptyRates,
    canBook: true,
    now: fixedNow,
  }

  it('carries TODAY, the collected fields, and the pre-extracted fields', () => {
    const v = buildVolatileContext(base)
    expect(v).toContain('2026-08-07') // TODAY resolved from injected clock
    expect(v).toContain('academic') // a collected field value
    expect(v).toContain('42') // a pre-extracted value
  })

  it('emits an account-restriction refusal note only when the actor is blocked', () => {
    const restricted = buildVolatileContext({ ...base, actorStatus: 'restricted' })
    expect(restricted.toUpperCase()).toContain('RESTRICTED')

    const active = buildVolatileContext({ ...base, actorStatus: 'active' })
    expect(active.toUpperCase()).not.toContain('ACCOUNT RESTRICTED')
  })
})
