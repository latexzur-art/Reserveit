import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { CancellationRequestsTab } from '@/app/academic/dashboard/_components/CancellationRequestsTab'

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cr-1',
    booking_id: 'b-1',
    user_id: 'u-1',
    reason: 'Change of plans for the event',
    status: 'pending',
    original_status: 'confirmed',
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
    auto_approved: false,
    refund_window_met: null,
    refund_destination_name: null,
    refund_destination_contact_number: null,
    created_at: new Date().toISOString(),
    users: { full_name: 'Jane Renter', email: 'jane@example.com' },
    bookings: {
      booking_reference: 'BK-1',
      booking_date: '2026-08-20',
      start_time: '08:00:00',
      end_time: '10:00:00',
      current_status: 'confirmed',
      booking_facilities: [{ facility_id: 'fac-1', facilities: { name: 'Room 309' } }],
    },
    ...overrides,
  }
}

describe('CancellationRequestsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders pending requests with the booking reference visible', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ requests: [makeRequest()] }),
    }) as unknown as typeof fetch

    render(<CancellationRequestsTab />)

    await waitFor(() => expect(screen.getByText(/BK-1/)).toBeInTheDocument())
    expect(screen.getByText('Jane Renter')).toBeInTheDocument()
  })

  it('shows the refund-eligibility badge when refund_window_met is true and destination fields are present', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requests: [
          makeRequest({
            refund_window_met: true,
            refund_destination_name: 'Jane Renter',
            refund_destination_contact_number: '09171234567',
          }),
        ],
      }),
    }) as unknown as typeof fetch

    render(<CancellationRequestsTab />)

    await waitFor(() => expect(screen.getByText(/BK-1/)).toBeInTheDocument())
    expect(screen.getByText(/full refund if approved/i)).toBeInTheDocument()
    expect(screen.getByText(/09171234567/)).toBeInTheDocument()
  })

  it('shows the outside-refund-window badge when refund_window_met is false but destination fields are present', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requests: [
          makeRequest({
            refund_window_met: false,
            refund_destination_name: 'Jane Renter',
            refund_destination_contact_number: '09171234567',
          }),
        ],
      }),
    }) as unknown as typeof fetch

    render(<CancellationRequestsTab />)

    await waitFor(() => expect(screen.getByText(/BK-1/)).toBeInTheDocument())
    expect(screen.getByText(/outside refund window/i)).toBeInTheDocument()
  })

  it('does not show a refund badge when there is no refund_destination_name (unpaid booking)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ requests: [makeRequest({ refund_window_met: null, refund_destination_name: null })] }),
    }) as unknown as typeof fetch

    render(<CancellationRequestsTab />)

    await waitFor(() => expect(screen.getByText(/BK-1/)).toBeInTheDocument())
    expect(screen.queryByText(/refund if approved/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/outside refund window/i)).not.toBeInTheDocument()
  })

  it('calls the respond endpoint when Approve — No Strike is clicked', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/respond')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ requests: [makeRequest()] }) })
    })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<CancellationRequestsTab />)

    await waitFor(() => expect(screen.getByText(/BK-1/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /approve.*no strike/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/academic-head/cancellation-requests/cr-1/respond',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('calls the respond endpoint when Reject is clicked', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/respond')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ requests: [makeRequest()] }) })
    })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<CancellationRequestsTab />)

    await waitFor(() => expect(screen.getByText(/BK-1/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/academic-head/cancellation-requests/cr-1/respond',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })
})
