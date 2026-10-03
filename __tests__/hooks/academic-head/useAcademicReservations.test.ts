import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAcademicReservations } from '@/hooks/academic-head/useAcademicReservations'

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

/** Helper to create a mock Response-like object */
function mockResponse(data: any, ok = true) {
  return { ok, json: () => Promise.resolve(data) }
}

const emptyReservations = { bookings: [], total: 0, totalPages: 1 }

describe('useAcademicReservations', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: all fetch calls return empty reservations
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/academic-head/reservations')) {
        return Promise.resolve(mockResponse(emptyReservations))
      }
      // Default for action endpoints
      return Promise.resolve(mockResponse({}))
    })
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch reservations on mount', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/academic-head/reservations')) {
        return Promise.resolve(mockResponse({
          bookings: [
            { id: 'b1', referenceNumber: 'REF-001', status: 'pending', facultyName: 'Prof Smith' },
          ],
          total: 1,
          totalPages: 1,
          departments: [{ id: 'd1', code: 'CS', name: 'Computer Science' }],
        }))
      }
      return Promise.resolve(mockResponse({}))
    })

    const { result } = renderHook(() => useAcademicReservations())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.bookings).toHaveLength(1)
    expect(result.current.bookings[0].referenceNumber).toBe('REF-001')
    expect(result.current.total).toBe(1)
    expect(result.current.departments).toHaveLength(1)
  })

  it('should handle fetch error gracefully', async () => {
    mockFetch.mockImplementation(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }))

    const { result } = renderHook(() => useAcademicReservations())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.bookings).toHaveLength(0)
  })

  it('should cancel a booking', async () => {
    const { result } = renderHook(() => useAcademicReservations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.cancelBooking('b1', 'No longer needed')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/academic-head/cancel-booking', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ booking_id: 'b1', reason: 'No longer needed' }),
    }))
  })

  it('should throw on failed cancel', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/academic-head/reservations')) {
        return Promise.resolve(mockResponse(emptyReservations))
      }
      if (typeof url === 'string' && url.includes('cancel-booking')) {
        return Promise.resolve(mockResponse({ error: 'Cannot cancel' }, false))
      }
      return Promise.resolve(mockResponse({}))
    })

    const { result } = renderHook(() => useAcademicReservations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(
      act(async () => {
        await result.current.cancelBooking('b1', 'reason')
      })
    ).rejects.toThrow('Cannot cancel')
  })

  it('should review (approve) a booking', async () => {
    const { result } = renderHook(() => useAcademicReservations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.reviewBooking('b1', 'approve', 'Looks good')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/academic-head/review-booking', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ booking_id: 'b1', action: 'approve', reason: 'Looks good' }),
    }))
  })

  it('should propose changes to a booking', async () => {
    const { result } = renderHook(() => useAcademicReservations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.proposeChanges('b1', {
        proposed_date: '2026-04-15',
        reason: 'Room conflict',
      })
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/academic-head/propose-changes', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('should delete a booking', async () => {
    const { result } = renderHook(() => useAcademicReservations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteBooking('b1')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/academic-head/bookings/b1', { method: 'DELETE' })
  })

  it('should bulk delete bookings', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('bulk-delete')) {
        return Promise.resolve(mockResponse({ deleted: 3 }))
      }
      if (typeof url === 'string' && url.includes('/api/academic-head/reservations')) {
        return Promise.resolve(mockResponse(emptyReservations))
      }
      return Promise.resolve(mockResponse({}))
    })

    const { result } = renderHook(() => useAcademicReservations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let count: number = 0
    await act(async () => {
      count = await result.current.bulkDeleteBookings(['b1', 'b2', 'b3'])
    })

    expect(count).toBe(3)
  })

  it('should reset page to 1 when filters change', async () => {
    const { result } = renderHook(() => useAcademicReservations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setPage(3)
    })

    expect(result.current.page).toBe(3)

    act(() => {
      result.current.setStatusFilter('approved')
    })

    await waitFor(() => {
      expect(result.current.page).toBe(1)
    })
  })
})
