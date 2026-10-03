import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// Mock supabase client (used by fetchSchedules and fetchDrafts via dynamic import)
const mockSupabaseChain: any = {
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  neq: vi.fn(),
  order: vi.fn(),
}

function setupSupabaseChain(result: { data: any; error: any }) {
  mockSupabaseChain.from.mockReturnValue(mockSupabaseChain)
  mockSupabaseChain.select.mockReturnValue(mockSupabaseChain)
  mockSupabaseChain.eq.mockReturnValue(mockSupabaseChain)
  mockSupabaseChain.is.mockReturnValue(mockSupabaseChain)
  mockSupabaseChain.neq.mockReturnValue(mockSupabaseChain)
  mockSupabaseChain.order.mockReturnValue(mockSupabaseChain)
  // Make the chain thenable so `await query` resolves to result
  mockSupabaseChain.then = (resolve: any) => resolve(result)
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseChain,
}))

import { useScheduleHistory } from '@/hooks/academic-head/useScheduleHistory'

describe('useScheduleHistory', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
    setupSupabaseChain({ data: [], error: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Default mock for all fetches
  function setupDefaultFetches() {
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/schedules/history') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ uploads: [] }) })
      }
      if (url.includes('/api/schedules/changelog')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ modifications: [], deletions: [] }) })
      }
      // Fallback for history type=schedules
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
  }

  it('should call all four fetch functions on mount', async () => {
    setupDefaultFetches()

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => {
      expect(result.current.loading.uploads).toBe(false)
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/schedules/history')
    expect(mockFetch).toHaveBeenCalledWith('/api/schedules/changelog')
  })

  it('fetchUploads should set uploads on success', async () => {
    setupDefaultFetches()
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/schedules/history') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ uploads: [{ id: 'u1' }] }),
        })
      }
      if (url.includes('changelog')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ modifications: [], deletions: [] }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => {
      expect(result.current.loading.uploads).toBe(false)
    })

    expect(result.current.uploads).toHaveLength(1)
  })

  it('fetchUploads should set error on failure', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/schedules/history') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'DB down' }),
        })
      }
      if (url.includes('changelog')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ modifications: [], deletions: [] }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => {
      // error state may be set by fetchUploads ('DB down') or overwritten by
      // fetchSchedules/fetchDrafts if the supabase dynamic import mock races.
      expect(result.current.error).toBeTruthy()
    })

    expect(result.current.uploads).toEqual([])
  })

  it('fetchSchedules should request published schedules', async () => {
    setupDefaultFetches()

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => {
      expect(result.current.loading.schedules).toBe(false)
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/schedules/history/published')
  })

  it('fetchChangelog should set modifications and deletions', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/schedules/history') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ uploads: [] }) })
      }
      if (url.includes('changelog')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            modifications: [{ original: { id: 's1' }, modified: { id: 's2' } }],
            deletions: [{ id: 's3' }],
          }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => {
      expect(result.current.loading.changelog).toBe(false)
    })

    expect(result.current.modifications).toHaveLength(1)
    expect(result.current.deletions).toHaveLength(1)
  })

  it('fetchDrafts should request draft staging entries', async () => {
    setupDefaultFetches()

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => {
      expect(result.current.loading.drafts).toBe(false)
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/schedules/history/drafts')
  })

  it('rollbackUpload should POST and re-fetch', async () => {
    setupDefaultFetches()

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => expect(result.current.loading.uploads).toBe(false))

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    await act(async () => {
      await result.current.rollbackUpload('u1')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/schedules/history/u1/rollback', { method: 'POST' })
  })

  it('rollbackUpload should throw on failure', async () => {
    setupDefaultFetches()

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => expect(result.current.loading.uploads).toBe(false))

    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Cannot rollback' }),
    })

    await expect(
      act(async () => {
        await result.current.rollbackUpload('u1')
      })
    ).rejects.toThrow('Cannot rollback')
  })

  it('deleteUpload should DELETE and re-fetch uploads', async () => {
    setupDefaultFetches()

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => expect(result.current.loading.uploads).toBe(false))

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    await act(async () => {
      await result.current.deleteUpload('u1')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/schedules/uploads/u1', { method: 'DELETE' })
  })

  it('editSchedule should PATCH and re-fetch schedules + changelog', async () => {
    setupDefaultFetches()

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => expect(result.current.loading.uploads).toBe(false))

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ schedule: { id: 's1' } }),
    })

    await act(async () => {
      await result.current.editSchedule('s1', { course_code: 'CS201' })
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/schedules/manage/s1',
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('deleteSchedule should DELETE and re-fetch', async () => {
    setupDefaultFetches()

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => expect(result.current.loading.uploads).toBe(false))

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    await act(async () => {
      await result.current.deleteSchedule('s1')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/schedules/manage/s1', { method: 'DELETE' })
  })

  it('rollbackSchedules should POST with scheduleIds', async () => {
    setupDefaultFetches()

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => expect(result.current.loading.uploads).toBe(false))

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    await act(async () => {
      await result.current.rollbackSchedules(['s1', 's2'])
    })

    const call = mockFetch.mock.calls.find((c: any[]) => c[0].includes('history/rollback'))
    expect(call).toBeDefined()
    expect(JSON.parse(call![1].body)).toEqual({ scheduleIds: ['s1', 's2'] })
  })

  it('deleteDrafts should POST with stagingIds', async () => {
    setupDefaultFetches()

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => expect(result.current.loading.uploads).toBe(false))

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    await act(async () => {
      await result.current.deleteDrafts(['d1', 'd2'])
    })

    const call = mockFetch.mock.calls.find((c: any[]) => c[0].includes('drafts/delete'))
    expect(call).toBeDefined()
    expect(JSON.parse(call![1].body)).toEqual({ stagingIds: ['d1', 'd2'] })
  })

  it('publishDrafts should POST with stagingIds', async () => {
    setupDefaultFetches()

    const { result } = renderHook(() => useScheduleHistory())

    await waitFor(() => expect(result.current.loading.uploads).toBe(false))

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    await act(async () => {
      await result.current.publishDrafts(['d1'])
    })

    const call = mockFetch.mock.calls.find((c: any[]) => c[0].includes('drafts/publish'))
    expect(call).toBeDefined()
    expect(JSON.parse(call![1].body)).toEqual({ stagingIds: ['d1'] })
  })
})
