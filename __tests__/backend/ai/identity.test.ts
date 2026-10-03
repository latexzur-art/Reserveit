import { describe, it, expect } from 'vitest'
import {
  ASSISTANT_NAME,
  assistantPersonaLine,
  assistantHeaderLabel,
  assistantGreeting,
  assistantDefaultGreeting,
} from '@/backend/ai/identity'
import { ROLE_CAPABILITIES } from '@/backend/ai/roleCapabilities'

describe('assistant identity — Rita', () => {
  it('names the assistant Rita', () => {
    expect(ASSISTANT_NAME).toBe('Rita')
  })

  describe('assistantPersonaLine', () => {
    it('opens by naming Rita and the active role', () => {
      const line = assistantPersonaLine('Program Head')
      expect(line.startsWith('You are Rita')).toBe(true)
      expect(line).toContain('Program Head')
    })

    it('threads whichever role label it is given', () => {
      expect(assistantPersonaLine('IT Administrator')).toContain('IT Administrator')
    })
  })

  describe('assistantHeaderLabel', () => {
    it('joins Rita with the role label', () => {
      expect(assistantHeaderLabel('Client')).toBe('Rita · Client')
    })

    it('falls back to just the name when no role is known', () => {
      expect(assistantHeaderLabel()).toBe('Rita')
      expect(assistantHeaderLabel(null)).toBe('Rita')
      expect(assistantHeaderLabel('')).toBe('Rita')
    })
  })

  describe('assistantGreeting', () => {
    it('offers booking verbs to a booking-capable role', () => {
      const g = assistantGreeting('Faculty', true)
      expect(g).toContain('Rita')
      expect(g).toContain('Faculty')
      expect(g).toContain('reserve rooms')
    })

    it('omits booking verbs for a non-booking role', () => {
      const g = assistantGreeting('IT Administrator', false)
      expect(g).toContain('Rita')
      expect(g).toContain('IT Administrator')
      expect(g).not.toContain('reserve rooms')
      expect(g).toContain('look things up')
    })
  })

  describe('assistantDefaultGreeting', () => {
    it('greets as Rita before the role has loaded', () => {
      expect(assistantDefaultGreeting()).toContain('Rita')
    })
  })

  // Every role that can mount the assistant on its dashboard must get a coherent,
  // constraint-respecting Rita identity — booking verbs only where canBook holds.
  describe('across every role in the capability registry', () => {
    const roles = Object.values(ROLE_CAPABILITIES)

    it('covers all seven roles', () => {
      expect(roles.length).toBe(7)
    })

    it.each(roles.map((c) => [c.role, c.label, c.canBook] as const))(
      'gives %s a Rita greeting + header consistent with its booking constraint',
      (_role, label, canBook) => {
        const greeting = assistantGreeting(label, canBook)
        expect(greeting).toContain('Rita')
        expect(greeting).toContain(label)
        // The booking verb must appear iff the role can actually book.
        expect(greeting.includes('reserve rooms')).toBe(canBook)

        expect(assistantHeaderLabel(label)).toBe(`Rita · ${label}`)
        expect(assistantPersonaLine(label).startsWith('You are Rita')).toBe(true)
      }
    )
  })
})
