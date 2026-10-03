import { describe, it, expect } from 'vitest'
import { deriveSessionTitle, generateSessionTitle } from '@/backend/ai/tools'

describe('deriveSessionTitle (deterministic fallback)', () => {
  it("uses the user's first message, trimmed", () => {
    const title = deriveSessionTitle(
      [
        { role: 'assistant', content: 'Hi, how can I help?' },
        { role: 'user', content: 'Book AVR for a seminar' },
        { role: 'assistant', content: 'Sure!' },
      ],
      null,
    )
    expect(title).toBe('Book AVR for a seminar')
  })

  it('truncates a very long first message with an ellipsis', () => {
    const long = 'I would like to reserve the audio visual room for a very long departmental seminar next week please'
    const title = deriveSessionTitle([{ role: 'user', content: long }], null)
    expect(title.length).toBeLessThanOrEqual(49) // 48 chars + ellipsis
    expect(title.endsWith('…')).toBe(true)
  })

  it('falls back to the booking summary when there is no user message', () => {
    const title = deriveSessionTitle(
      [{ role: 'assistant', content: 'Welcome' }],
      { facility_name: 'Room 101', booking_purpose: 'lecture' },
    )
    expect(title.toLowerCase()).toContain('room 101')
  })

  it("returns 'Conversation' when there is nothing to summarize", () => {
    expect(deriveSessionTitle([], null)).toBe('Conversation')
    expect(deriveSessionTitle(null, null)).toBe('Conversation')
  })
})

describe('generateSessionTitle (LLM with graceful fallback)', () => {
  const msgs = [{ role: 'user', content: 'what rooms are free tomorrow?' }]

  it('returns the cleaned model title', async () => {
    const complete = async () => '  Room Availability Check  '
    expect(await generateSessionTitle(msgs, null, complete)).toBe('Room Availability Check')
  })

  it('strips surrounding quotes, a "Title:" prefix, and a trailing period', async () => {
    const complete = async () => 'Title: "AVR Seminar Booking".'
    expect(await generateSessionTitle(msgs, null, complete)).toBe('AVR Seminar Booking')
  })

  it('truncates an over-long model title', async () => {
    const complete = async () => 'An Extremely Verbose Title That The Model Should Not Have Produced At All'
    const title = await generateSessionTitle(msgs, null, complete)
    expect(title.length).toBeLessThanOrEqual(49)
  })

  it('falls back to the deterministic title when the model call throws', async () => {
    const complete = async () => {
      throw new Error('LLM down')
    }
    expect(await generateSessionTitle(msgs, null, complete)).toBe('what rooms are free tomorrow?')
  })

  it('falls back when the model returns an empty string', async () => {
    const complete = async () => '   '
    expect(await generateSessionTitle(msgs, null, complete)).toBe('what rooms are free tomorrow?')
  })
})
