import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useReservations } from '@/hooks/faculty/useReservations'

const stableToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: stableToast }),
}))

function mockResponse(data: any, ok = true) {
  return { ok, json: () => Promise.resolve(data) }
}

describe('useReservations', () => {
  const mockFetch = vi.fn()

  const mockBooking = {
    id: 'b1',
    booking_reference: 'REF-001',
    booking_date: '2026-04-01',
    start_time: '09:00:00',
    end_time: '10:00:00',
    current_status: 'pending',
    booking_purpose: 'academic',
    purpose: 'Lecture',
    expected_attendees: 30,
    mismatch_flag: null,
    mismatch_alternative_facility_id: null,
    booking_facilities: [{
      facility: {
        name: 'Room 101',
        room_number: '101',
        floors: { floor_number: 1, buildings: { name: 'Main' } },
      },
    }],
    booking_overrides: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/bookings')) {
        return Promise.resolve(mockResponse({ bookings: [mockBooking], total: 1 }))
      }
      return Promise.resolve(mockResponse({}))
    })
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch bookings on mount', async () => {
    const { result } = renderHook(() => useReservations())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.bookings).toHaveLength(1)
    expect(result.current.bookings[0].booking_reference).toBe('REF-001')
    expect(result.current.bookings[0].facility_name).toBe('Room 101')
    expect(result.current.bookings[0].building_name).toBe('Main')
    expect(result.current.total).toBe(1)
    expect(result.current.totalPages).toBe(1)
  })

  it('should handle fetch error gracefully', async () => {
    mockFetch.mockImplementation(() => Promise.resolve(mockResponse({}, false)))

    const { result } = renderHook(() => useReservations())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.bookings).toHaveLength(0)
  })

  it('should cancel a booking with optimistic update', async () => {
    mockFetch.mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/cancel')) {
        return Promise.resolve(mockResponse({ success: true }))
      }
      return Promise.resolve(mockResponse({ bookings: [mockBooking], total: 1 }))
    })

    const { result } = renderHook(() => useReservations())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.cancelBooking('b1', 'No longer needed')
    })

    // Optimistic update: status changes to cancelled
    expect(result.current.bookings[0].current_status).toBe('cancelled')
  })

  it('should throw on cancel failure', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/cancel')) {
        return Promise.resolve(mockResponse({ error: 'Cannot cancel' }, false))
      }
      return Promise.resolve(mockResponse({ bookings: [mockBooking], total: 1 }))
    })

    const { result } = renderHook(() => useReservations())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Cancel should not crash (error handled by toast)
    await act(async () => {
      await result.current.cancelBooking('b1', 'reason')
    })

    // cancelling state should be reset
    expect(result.current.cancelling).toBeNull()
  })

  it('should respond to proposal (accept)', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('respond-proposal')) {
        return Promise.resolve(mockResponse({ success: true }))
      }
      return Promise.resolve(mockResponse({ bookings: [], total: 0 }))
    })

    const { result } = renderHook(() => useReservations())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.respondToProposal('b1', 'accept')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/academic-head/respond-proposal', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ booking_id: 'b1', action: 'accept' }),
    }))
  })

  it('should respond to alternative facility', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('accept-alternative')) {
        return Promise.resolve(mockResponse({ success: true }))
      }
      return Promise.resolve(mockResponse({ bookings: [], total: 0 }))
    })

    const { result } = renderHook(() => useReservations())

    await waitFor(() => expect(result.current.loading).toBe(false))

    let success = false
    await act(async () => {
      success = await result.current.respondToAlternative('b1', true)
    })

    expect(success).toBe(true)
  })

  it('should reset page to 1 when filter changes', async () => {
    const { result } = renderHook(() => useReservations())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.setPage(3) })
    expect(result.current.page).toBe(3)

    act(() => { result.current.setStatusFilter('approved') })

    await waitFor(() => expect(result.current.page).toBe(1))
  })

  it('should include scope in fetch params when scope option is provided', async () => {
    const { result } = renderHook(() => useReservations({ scope: 'all' }))

    await waitFor(() => expect(result.current.loading).toBe(false))

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('scope=all')
  })

  it('should not include scope in fetch params by default', async () => {
    const { result } = renderHook(() => useReservations())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).not.toContain('scope=')
  })

  it('should map pending_faculty_response with proposal', async () => {
    const bookingWithProposal = {
      ...mockBooking,
      current_status: 'pending_faculty_response',
      booking_overrides: [{
        id: 'ov-1',
        override_action: 'propose_change',
        new_values: { booking_date: '2026-04-15', start_time: '10:00' },
        reason: 'Room conflict',
        created_at: '2026-03-26T00:00:00Z',
      }],
    }

    mockFetch.mockImplementation(() =>
      Promise.resolve(mockResponse({ bookings: [bookingWithProposal], total: 1 }))
    )

    const { result } = renderHook(() => useReservations())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.bookings[0].pending_proposal).not.toBeNull()
    expect(result.current.bookings[0].pending_proposal!.proposed_date).toBe('2026-04-15')
    expect(result.current.bookings[0].pending_proposal!.reason).toBe('Room conflict')
  })
})
