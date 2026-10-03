import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { createRef } from 'react'

vi.mock('@/lib/featureFlags', () => ({ AI_FEATURES_ENABLED: true }))

// Stateful stub standing in for the real chat body. Its counter proves whether
// the component instance survives a close/reopen (state preserved) or is
// remounted (state reset) — i.e. whether the conversation would be lost.
vi.mock('@/components/ai/BookingChatbot', () => {
  const React = require('react')
  return {
    BookingChatbot: () => {
      const [n, setN] = React.useState(0)
      return React.createElement(
        'button',
        { 'data-testid': 'convo', onClick: () => setN((v: number) => v + 1) },
        `msgs:${n}`,
      )
    },
  }
})

import {
  BookingChatbotModal,
  type BookingChatbotModalHandle,
} from '@/components/ai/BookingChatbotModal'

describe('BookingChatbotModal — conversation survives minimize', () => {
  it('keeps the chat state when the backdrop is clicked and the modal reopened', () => {
    const ref = createRef<BookingChatbotModalHandle>()
    render(<BookingChatbotModal ref={ref} formRoute="/client/booking" />)

    // Open and build up some "conversation" state.
    act(() => ref.current?.open())
    const convo = screen.getByTestId('convo')
    act(() => convo.click())
    act(() => convo.click())
    expect(screen.getByTestId('convo').textContent).toBe('msgs:2')

    // Minimize by clicking outside (the backdrop).
    act(() => screen.getByTestId('assistant-backdrop').click())

    // The chat body must NOT be unmounted — its state is intact, just hidden.
    expect(screen.getByTestId('convo').textContent).toBe('msgs:2')

    // Reopen: same conversation is still there.
    act(() => ref.current?.open())
    expect(screen.getByTestId('convo').textContent).toBe('msgs:2')
  })
})
