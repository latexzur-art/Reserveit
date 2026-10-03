import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { createRef } from 'react'

// The modal is feature-flagged and embeds the heavy chat body (which fires
// network effects on mount). Force the flag on and stub the body so this test
// isolates the modal's own header identity.
vi.mock('@/lib/featureFlags', () => ({ AI_FEATURES_ENABLED: true }))
vi.mock('@/components/ai/BookingChatbot', () => ({
  BookingChatbot: () => <div data-testid="chat-body" />,
}))

import {
  BookingChatbotModal,
  type BookingChatbotModalHandle,
} from '@/components/ai/BookingChatbotModal'

describe('BookingChatbotModal header identity', () => {
  it('names the assistant Rita in the header once opened', () => {
    const ref = createRef<BookingChatbotModalHandle>()
    render(<BookingChatbotModal ref={ref} formRoute="/client/booking" />)

    // Header only mounts when the modal is open.
    act(() => {
      ref.current?.open()
    })

    expect(screen.getByText('Rita')).toBeInTheDocument()
    expect(screen.queryByText('AI Assistant')).not.toBeInTheDocument()
  })
})
