import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { useFacultyDashboard } from '@/hooks/faculty/useFacultyDashboard'

function mockResponse(data: any, ok = true) {
  return { ok, json: () => Promise.resolve(data) }
}

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    SWRConfig,
    {
      value: {
        provider: () => new Map(),
        dedupingInterval: 0,
        revalidateOnFocus: false,
        fetcher: (url: string) => fetch(url).then((res) => res.json()),
      },
    },
    children
  )

describe('useFacultyDashboard', () => {
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
      // Today's active reservations (dedicated fetch — Bug #2 fix)
      // Must come before the generic 'dateFrom' branch
      if (url.includes('auto_approved,approved,overridden') && url.includes('dateFrom')) {
        return Promise.resolve(mockResponse({ total: 5 }))
      }
      // Recent bookings (pageSize=5 exactly — use & boundary to avoid matching pageSize=50)
      if (url.includes('/api/bookings') && (url.includes('pageSize=5&') || url.endsWith('pageSize=5'))) {
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
      return Promise.resolve(mockResponse({}))
    })
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch all data on mount', async () => {
    const { result } = renderHook(() => useFacultyDashboard(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockFetch).toHaveBeenCalledTimes(7)
  })

  it('should compute stats correctly', async () => {
    const { result } = renderHook(() => useFacultyDashboard(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.stats.totalReservations).toBe(10)
    expect(result.current.stats.pendingRequests).toBe(3)
    expect(result.current.stats.upcomingBookings).toBe(5)
  })

  it('should compute activeReservations from today approved bookings', async () => {
    const { result } = renderHook(() => useFacultyDashboard(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    // The dedicated today-active fetch (status=auto_approved,approved,overridden&dateFrom=...)
    // matches the explicit mock branch and returns total: 5
    expect(result.current.stats.activeReservations).toBe(5)
  })

  it('should return recent bookings mapped to display format', async () => {
    const { result } = renderHook(() => useFacultyDashboard(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.recentBookings).toHaveLength(2)
    expect(result.current.recentBookings[0].facility).toBe('Room 101')
    expect(result.current.recentBookings[0].building).toBe('Main')
    expect(result.current.recentBookings[0].status).toBe('confirmed')
    expect(result.current.recentBookings[1].status).toBe('pending')
  })

  it('should return notifications', async () => {
    const { result } = renderHook(() => useFacultyDashboard(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0].title).toBe('Test')
  })

  it('should return facilities (max 5)', async () => {
    const { result } = renderHook(() => useFacultyDashboard(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.facilities).toHaveLength(1)
    expect(result.current.facilities[0].name).toBe('Room 101')
  })

  it('should handle API errors gracefully', async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')))

    const { result } = renderHook(() => useFacultyDashboard(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.recentBookings).toHaveLength(0)
    expect(result.current.stats.totalReservations).toBe(0)
  })

  it('should refresh data when refresh() is called', async () => {
    const { result } = renderHook(() => useFacultyDashboard(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const callsBefore = mockFetch.mock.calls.length

    await act(async () => {
      await result.current.refresh()
    })

    expect(mockFetch.mock.calls.length).toBe(callsBefore + 7)
  })
})
