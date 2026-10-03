import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// Mock supabase client - thenable chain pattern
const mockSupabaseChain: any = {}
const setupChain = (result: { data: any; error: any }) => {
  mockSupabaseChain.from = vi.fn().mockReturnValue(mockSupabaseChain)
  mockSupabaseChain.select = vi.fn().mockReturnValue(mockSupabaseChain)
  mockSupabaseChain.order = vi.fn().mockReturnValue(mockSupabaseChain)
  mockSupabaseChain.eq = vi.fn().mockReturnValue(mockSupabaseChain)
  mockSupabaseChain.in = vi.fn().mockReturnValue(mockSupabaseChain)
  mockSupabaseChain.update = vi.fn().mockReturnValue(mockSupabaseChain)
  // Make the chain thenable so `await query` resolves to result
  mockSupabaseChain.then = (resolve: any) => resolve(result)
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseChain,
}))

import { useScheduleUploads, useScheduleEntries } from '@/hooks/academic-head/useScheduleUploads'

describe('useScheduleUploads', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch uploads on mount', async () => {
    setupChain({ data: [{ id: 'u1', upload_status: 'pending' }], error: null })

    const { result } = renderHook(() => useScheduleUploads())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.uploads).toHaveLength(1)
    expect(result.current.uploads[0].id).toBe('u1')
  })

  it('should set error on fetch failure', async () => {
    setupChain({ data: null, error: { message: 'DB connection failed' } })

    const { result } = renderHook(() => useScheduleUploads())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('DB connection failed')
    expect(result.current.uploads).toEqual([])
  })

  it('should filter by single status string', async () => {
    setupChain({ data: [], error: null })

    renderHook(() => useScheduleUploads({ status: 'pending_review' }))

    await waitFor(() => {
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('upload_status', 'pending_review')
    })
  })

  it('should filter by status array using .in()', async () => {
    setupChain({ data: [], error: null })

    renderHook(() => useScheduleUploads({ status: ['pending_review', 'submitted'] }))

    await waitFor(() => {
      expect(mockSupabaseChain.in).toHaveBeenCalledWith('upload_status', ['pending_review', 'submitted'])
    })
  })

  it('should filter by termId', async () => {
    setupChain({ data: [], error: null })

    renderHook(() => useScheduleUploads({ termId: 't1' }))

    await waitFor(() => {
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('academic_term_id', 't1')
    })
  })

  it('should expose refetch function', async () => {
    setupChain({ data: [], error: null })

    const { result } = renderHook(() => useScheduleUploads())

    await waitFor(() => expect(result.current.loading).toBe(false))

    setupChain({ data: [{ id: 'u2' }], error: null })

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.uploads).toHaveLength(1)
  })
})

describe('useScheduleEntries', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should not fetch if uploadId is null', async () => {
    const { result } = renderHook(() => useScheduleEntries(null))

    // Should remain in initial state
    expect(result.current.entries).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should fetch entries on mount when uploadId is provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ entries: [{ id: 'e1' }] }),
    })

    const { result } = renderHook(() => useScheduleEntries('upload-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.entries).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/schedules/uploads/upload-1/entries')
  })

  it('should set error on fetch failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    })

    const { result } = renderHook(() => useScheduleEntries('upload-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Not found')
    expect(result.current.entries).toEqual([])
  })

  it('editEntry should PUT and re-fetch', async () => {
    // Initial fetch
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: [{ id: 'e1' }] }),
      })
      // PUT response
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entry: { id: 'e1', updated: true } }),
      })
      // Re-fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: [{ id: 'e1', updated: true }] }),
      })

    const { result } = renderHook(() => useScheduleEntries('upload-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.editEntry('e1', { course_code: 'CS102' })
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/schedules/review/upload-1/entries/e1',
      expect.objectContaining({ method: 'PUT' })
    )
  })

  it('editEntry should set error and throw on failure', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Validation failed' }),
      })

    const { result } = renderHook(() => useScheduleEntries('upload-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(
      act(async () => {
        await result.current.editEntry('e1', { course_code: '' })
      })
    ).rejects.toThrow('Validation failed')
  })

  it('batchReview should POST to the batch-review endpoint and re-fetch', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: [{ id: 'e1' }] }),
      })
      // batch-review POST
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      // Re-fetch after review
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: [{ id: 'e1', academic_head_review_status: 'academic_head_approved' }] }),
      })

    const { result } = renderHook(() => useScheduleEntries('upload-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.batchReview(['e1'], 'academic_head_approved', 'Looks good')
    })

    const call = mockFetch.mock.calls.find((c: any[]) => typeof c[0] === 'string' && c[0].includes('/batch-review'))
    expect(call).toBeDefined()
    expect(call![1].method).toBe('POST')
    const body = JSON.parse(call![1].body)
    expect(body.actions[0]).toMatchObject({ entry_id: 'e1', action: 'academic_head_approved', notes: 'Looks good' })
  })

  it('reviewEntry should delegate to batchReview', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: [{ id: 'e1' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: [{ id: 'e1' }] }),
      })

    const { result } = renderHook(() => useScheduleEntries('upload-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.reviewEntry('e1', 'academic_head_rejected', 'Needs revision')
    })

    const call = mockFetch.mock.calls.find((c: any[]) => typeof c[0] === 'string' && c[0].includes('/batch-review'))
    expect(call).toBeDefined()
    const body = JSON.parse(call![1].body)
    expect(body.actions).toEqual([{ entry_id: 'e1', action: 'academic_head_rejected', notes: 'Needs revision' }])
  })
})
