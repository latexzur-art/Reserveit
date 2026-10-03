import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useMismatchReviews } from '@/hooks/academic-head/useMismatchReviews'

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

describe('useMismatchReviews', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch reviews on mount', async () => {
    const mockReviews = [
      {
        bookingId: 'b1',
        referenceNumber: 'REF-001',
        currentStatus: 'flagged',
        facultyName: 'Prof Smith',
        department: 'CS',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reviews: mockReviews }),
    })

    const { result } = renderHook(() => useMismatchReviews())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.reviews).toHaveLength(1)
    expect(result.current.reviews[0].bookingId).toBe('b1')
  })

  it('should handle fetch error', async () => {
    mockFetch.mockResolvedValue({ ok: false })

    const { result } = renderHook(() => useMismatchReviews())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.reviews).toHaveLength(0)
  })

  it('should submit an approve review', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reviews: [{ bookingId: 'b1' }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reviews: [] }),
      })

    const { result } = renderHook(() => useMismatchReviews())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.submitReview('b1', 'approve')
    })

    // Should call the mismatch-review endpoint
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/bookings/b1/mismatch-review',
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('should submit a decline review with notes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reviews: [{ bookingId: 'b1' }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reviews: [] }),
      })

    const { result } = renderHook(() => useMismatchReviews())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.submitReview('b1', 'decline', { reviewerNotes: 'Not appropriate' })
    })

    const patchCall = mockFetch.mock.calls.find(
      (c: any[]) => c[0] === '/api/bookings/b1/mismatch-review'
    )
    expect(patchCall).toBeDefined()
    const body = JSON.parse(patchCall![1].body)
    expect(body.action).toBe('decline')
    expect(body.reviewer_notes).toBe('Not appropriate')
  })

  it('should suggest an alternative facility', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reviews: [{ bookingId: 'b1' }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reviews: [] }),
      })

    const { result } = renderHook(() => useMismatchReviews())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.submitReview('b1', 'suggest_alternative', {
        alternativeFacilityId: 'f2',
        reviewerNotes: 'Use Room 202 instead',
      })
    })

    const patchCall = mockFetch.mock.calls.find(
      (c: any[]) => c[0] === '/api/bookings/b1/mismatch-review'
    )
    const body = JSON.parse(patchCall![1].body)
    expect(body.action).toBe('suggest_alternative')
    expect(body.alternative_facility_id).toBe('f2')
  })

  it('should track submitting state per booking', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reviews: [{ bookingId: 'b1' }] }),
      })

    const { result } = renderHook(() => useMismatchReviews())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.submitting).toBeNull()

    // Start a review but don't resolve yet
    let resolveReview: any
    mockFetch.mockReturnValueOnce(
      new Promise(resolve => {
        resolveReview = resolve
      })
    )

    act(() => {
      result.current.submitReview('b1', 'approve')
    })

    expect(result.current.submitting).toBe('b1')

    // Resolve
    resolveReview({ ok: true, json: () => Promise.resolve({}) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ reviews: [] }),
    })

    await waitFor(() => {
      expect(result.current.submitting).toBeNull()
    })
  })
})
