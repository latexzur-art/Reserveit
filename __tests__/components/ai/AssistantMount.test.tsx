import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// building_admin is a real, non-booking-capable role — a good check that the
// launcher shows for admin dashboards, not just booking roles.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', roles: [{ name: 'building_admin' }] } }),
}))
// Stub the heavy chat body (fires network effects on mount) so the mount +
// launcher can be tested in isolation.
vi.mock('@/components/ai/BookingChatbot', () => ({
  BookingChatbot: () => <div data-testid="chat-body" />,
}))

import { AssistantMount } from '@/components/ai/AssistantMount'

describe('AssistantMount — Rita is reachable', () => {
  it('renders a launcher button that opens the assistant', () => {
    render(<AssistantMount />)

    // A visible, labelled launcher exists...
    const launcher = screen.getByRole('button', { name: /rita/i })
    expect(launcher).toBeInTheDocument()

    // ...and the chat is closed until it is clicked.
    expect(screen.queryByTestId('chat-body')).not.toBeInTheDocument()

    act(() => {
      launcher.click()
    })

    // Clicking the launcher opens the modal (chat body now mounted).
    expect(screen.getByTestId('chat-body')).toBeInTheDocument()
  })
})
