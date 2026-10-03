import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LookupCard } from '@/components/ai/chatbot/cards'

/** The exact payload shape from the user's screenshot — verifies the card
 *  contains human text and zero raw JSON / internal identifiers. */
const SCREENSHOT_PAYLOAD = {
  tool: 'view_person',
  result: {
    person: {
      id: '07410e3d-2f14-4282-b194-0b6f24390647',
      name: 'Marcus Soler',
      email: 'msoler@reserve.edu',
      role: 'program_head',
      departmentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      source: 'users',
      status: 'active',
    },
    facets: {
      bookings: [
        { reference: 'BK-2025-001', status: 'approved', facility_name: 'Room 301', date: '2025-06-15' },
      ],
    },
  },
}

describe('LookupCard — screenshot regression', () => {
  it('renders human-readable person fields', () => {
    const { container } = render(<LookupCard data={SCREENSHOT_PAYLOAD} />)
    const text = container.textContent ?? ''

    // MUST contain the person's name and humanized role
    expect(text).toContain('Marcus Soler')
    expect(text).toContain('Program Head')
  })

  it('contains no UUID substrings', () => {
    const { container } = render(<LookupCard data={SCREENSHOT_PAYLOAD} />)
    const text = container.textContent ?? ''

    // No UUID should leak
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i)
  })

  it('contains no raw "source" key noise', () => {
    const { container } = render(<LookupCard data={SCREENSHOT_PAYLOAD} />)
    const text = container.textContent ?? ''

    expect(text).not.toContain('"source"')
    // Also, the value 'users' (from source: 'users') should not appear as
    // a standalone label — but 'Users' as a label for the tool is OK.
    // We check that the Source label isn't rendered:
    expect(text).not.toContain('Source')
  })

  it('contains no JSON braces', () => {
    const { container } = render(<LookupCard data={SCREENSHOT_PAYLOAD} />)
    const html = container.innerHTML

    // No raw JSON delimiters
    expect(html).not.toContain('{')
    expect(html).not.toContain('}')
  })

  it('renders error state for error payloads', () => {
    const { container } = render(
      <LookupCard data={{ tool: 'view_person', result: { error: 'Not found' } }} />
    )
    expect(container.textContent).toContain('Not found')
  })

  it('renders empty state gracefully', () => {
    const { container } = render(
      <LookupCard data={{ tool: 'get_roles', result: null }} />
    )
    expect(container.textContent).toContain('No further details')
  })
})
