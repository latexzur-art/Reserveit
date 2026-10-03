import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useFacultyNotifications } from '@/hooks/faculty/useFacultyNotifications'

function mockResponse(data: any, ok = true) {
  return { ok, json: () => Promise.resolve(data) }
}

describe('useFacultyNotifications', () => {
  const mockFetch = vi.fn()

  const mockNotifications = [
    { id: 'n1', title: 'Booking Approved', message: 'Your booking was approved', type: 'success', read: false, created_at: '2026-03-25T10:00:00Z' },
    { id: 'n2', title: 'Schedule Update', message: 'New schedule available', type: 'info', read: true, created_at: '2026-03-24T10:00:00Z' },
    { id: 'n3', title: 'Warning', message: 'Conflict detected', type: 'warning', read: false, created_at: '2026-03-23T10:00:00Z' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/notifications') && !url.includes('/read')) {
        return Promise.resolve(mockResponse({
          notifications: mockNotifications,
          unread_count: 2,
        }))
      }
      // PATCH endpoints
      return Promise.resolve(mockResponse({}))
    })
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch notifications on mount', async () => {
    const { result } = renderHook(() => useFacultyNotifications())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.notifications).toHaveLength(3)
    expect(result.current.unreadCount).toBe(2)
  })

  it('should map notification types correctly', async () => {
    const { result } = renderHook(() => useFacultyNotifications())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.notifications[0].type).toBe('success')
    expect(result.current.notifications[1].type).toBe('info')
    expect(result.current.notifications[2].type).toBe('warning')
  })

  it('should convert created_at to Date objects', async () => {
    const { result } = renderHook(() => useFacultyNotifications())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.notifications[0].createdAt).toBeInstanceOf(Date)
  })

  it('should handle fetch error silently', async () => {
    mockFetch.mockImplementation(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }))

    const { result } = renderHook(() => useFacultyNotifications())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.notifications).toHaveLength(0)
  })

  it('should mark a notification as read (optimistic)', async () => {
    const { result } = renderHook(() => useFacultyNotifications())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.markRead('n1')
    })

    // Optimistic: n1 is now read
    expect(result.current.notifications.find(n => n.id === 'n1')?.read).toBe(true)
    expect(result.current.unreadCount).toBe(1) // was 2, now 1

    // Should have called PATCH
    expect(mockFetch).toHaveBeenCalledWith('/api/notifications/n1/read', { method: 'PATCH' })
  })

  it('should mark all as read', async () => {
    const { result } = renderHook(() => useFacultyNotifications())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.markAllRead()
    })

    expect(result.current.notifications.every(n => n.read)).toBe(true)
    expect(result.current.unreadCount).toBe(0)

    expect(mockFetch).toHaveBeenCalledWith('/api/notifications/read-all', { method: 'PATCH' })
  })

  it('should clear all notifications', async () => {
    const { result } = renderHook(() => useFacultyNotifications())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.clearAll()
    })

    expect(result.current.notifications).toHaveLength(0)
    expect(result.current.unreadCount).toBe(0)
  })

  it('should respect limit parameter', async () => {
    renderHook(() => useFacultyNotifications(5))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('limit=5'))
    })
  })
})
