import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useProgramHeadDashboard } from '@/app/program/_hooks/useProgramHeadDashboard'

function mockResponse(data: any, ok = true) {
  return { ok, json: () => Promise.resolve(data) }
}

describe('useProgramHeadDashboard', () => {
  const mockFetch = vi.fn()
  const today = new Date().toISOString().slice(0, 10)

  const mockBookings = [
    {
      id: 'b1',
      booking_reference: 'REF-001',
      booking_date: today,
      start_time: '09:00:00',
      end_time: '10:00:00',
      current_status: 'approved',
      booking_facilities: [{
        facility: { name: 'Room 101', room_number: '101', floors: { floor_number: 1, buildings: { name: 'Main' } } },
      }],
    },
    {
      id: 'b2',
      booking_reference: 'REF-002',
      booking_date: '2026-05-01',
      start_time: '14:00:00',
      end_time: '15:00:00',
      current_status: 'pending',
      booking_facilities: [{
        facility: { name: 'Room 202', room_number: '202', floors: { floor_number: 2, buildings: { name: 'Annex' } } },
      }],
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/bookings') && url.includes('pageSize=5')) {
        return Promise.resolve(mockResponse({ bookings: mockBookings, total: 10 }))
      }
      if (url.includes('/api/bookings') && url.includes('dateFrom')) {
        return Promise.resolve(mockResponse({ total: 5 }))
      }
      if (url.includes('/api/bookings') && url.includes('status=pending')) {
        return Promise.resolve(mockResponse({ total: 3 }))
      }
      if (url.includes('/api/notifications')) {
        return Promise.resolve(mockResponse({
          notifications: [{ id: 'n1', title: 'Test', message: 'Hello', type: 'info', created_at: new Date().toISOString() }],
        }))
      }
      if (url.includes('/api/facilities')) {
        return Promise.resolve(mockResponse({
          facilities: [{ id: 'f1', name: 'Room 101', capacity: 40 }],
        }))
      }
      if (url.includes('/api/schedules/change-requests')) {
        return Promise.resolve(mockResponse({ change_requests: [{ id: 'cr1' }, { id: 'cr2' }] }))
      }
      if (url.includes('/api/schedules/live')) {
        return Promise.resolve(mockResponse({ schedules: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] }))
      }
      return Promise.resolve(mockResponse({}))
    })
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch all data on mount', async () => {
    const { result } = renderHook(() => useProgramHeadDashboard())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Should have called 9 endpoints
    expect(mockFetch).toHaveBeenCalledTimes(9)
  })

  it('should compute stats correctly', async () => {
    const { result } = renderHook(() => useProgramHeadDashboard())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.stats.totalReservations).toBe(10)
    expect(result.current.stats.pendingRequests).toBe(3)
    expect(result.current.stats.upcomingBookings).toBe(5)
    expect(result.current.stats.pendingChangeRequests).toBe(2)
    expect(result.current.stats.approvedSchedules).toBe(3)
  })

  it('should compute activeReservations from today approved bookings', async () => {
    const { result } = renderHook(() => useProgramHeadDashboard())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // b1 is today + approved → counts as active
    // b2 is future date → not active today
    expect(result.current.stats.activeReservations).toBe(1)
  })

  it('should return recent bookings mapped to display format', async () => {
    const { result } = renderHook(() => useProgramHeadDashboard())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.recentBookings).toHaveLength(2)
    expect(result.current.recentBookings[0].facility).toBe('Room 101')
    expect(result.current.recentBookings[0].building).toBe('Main')
    expect(result.current.recentBookings[0].status).toBe('confirmed') // approved → confirmed
    expect(result.current.recentBookings[1].status).toBe('pending')
  })

  it('should return notifications', async () => {
    const { result } = renderHook(() => useProgramHeadDashboard())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0].title).toBe('Test')
  })

  it('should return facilities (max 5)', async () => {
    const { result } = renderHook(() => useProgramHeadDashboard())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.facilities).toHaveLength(1)
    expect(result.current.facilities[0].name).toBe('Room 101')
  })

  it('should handle API errors gracefully', async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')))

    const { result } = renderHook(() => useProgramHeadDashboard())

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Should not crash, just have empty data
    expect(result.current.recentBookings).toHaveLength(0)
    expect(result.current.stats.totalReservations).toBe(0)
  })

  it('should handle partial failures (change-requests/live endpoints fail)', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('change-requests') || url.includes('live')) {
        return Promise.reject(new Error('Not found'))
      }
      if (url.includes('/api/bookings') && url.includes('pageSize=5')) {
        return Promise.resolve(mockResponse({ bookings: [], total: 0 }))
      }
      if (url.includes('/api/bookings')) {
        return Promise.resolve(mockResponse({ total: 0 }))
      }
      return Promise.resolve(mockResponse({}))
    })

    const { result } = renderHook(() => useProgramHeadDashboard())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.stats.pendingChangeRequests).toBe(0)
    expect(result.current.stats.approvedSchedules).toBe(0)
  })

  it('should refresh data when refresh() is called', async () => {
    const { result } = renderHook(() => useProgramHeadDashboard())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const callsBefore = mockFetch.mock.calls.length

    await act(async () => {
      await result.current.refresh()
    })

    // Should have fetched 9 more endpoints
    expect(mockFetch.mock.calls.length).toBe(callsBefore + 9)
  })
})
