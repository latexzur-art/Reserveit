import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFacilityCatalogLookup } from '@/hooks/shared/useFacilityCatalogLookup'

describe('useFacilityCatalogLookup', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts as an empty Map before the catalog fetch resolves (loading state)', async () => {
    // Hold the fetch open to inspect the in-flight window right after mount, then
    // resolve it before the test ends so nothing is left dangling.
    let resolveFetch: (value: { ok: boolean; json: () => Promise<unknown> }) => void
    mockFetch.mockReturnValue(new Promise(resolve => { resolveFetch = resolve }))

    const { result } = renderHook(() => useFacilityCatalogLookup())

    expect(result.current.get('facility-1')).toBeUndefined()

    resolveFetch!({ ok: true, json: () => Promise.resolve({ facilities: [] }) })
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
  })

  it('populates amenities (name/quantity/notes) per facility once the fetch resolves', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        facilities: [
          {
            id: 'facility-1',
            coverPhotoUrl: '/photo.jpg',
            facilityTypeName: 'Classroom',
            hasActiveWarning: false,
            avgRating: 4.5,
            amenities: [
              { name: 'projector', displayName: 'Projector', icon: null, category: 'av', quantity: 2, notes: 'Ceiling-mounted' },
            ],
          },
        ],
      }),
    })

    const { result } = renderHook(() => useFacilityCatalogLookup())

    await waitFor(() => {
      expect(result.current.get('facility-1')).toBeDefined()
    })

    const entry = result.current.get('facility-1')
    expect(entry?.amenities).toEqual([
      { name: 'projector', displayName: 'Projector', icon: null, category: 'av', quantity: 2, notes: 'Ceiling-mounted' },
    ])
    expect(entry?.coverPhotoUrl).toBe('/photo.jpg')
  })

  it('resolves a facility with no equipment to a genuine empty array, not undefined', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        facilities: [
          {
            id: 'facility-empty',
            coverPhotoUrl: null,
            facilityTypeName: 'Classroom',
            hasActiveWarning: false,
            avgRating: null,
            amenities: [],
          },
        ],
      }),
    })

    const { result } = renderHook(() => useFacilityCatalogLookup())

    await waitFor(() => {
      expect(result.current.get('facility-empty')).toBeDefined()
    })

    expect(result.current.get('facility-empty')?.amenities).toEqual([])
  })

  it('defaults amenities to [] when the catalog response omits the field for a facility', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        facilities: [
          { id: 'facility-no-field', coverPhotoUrl: null, facilityTypeName: 'Gym', hasActiveWarning: false, avgRating: null },
        ],
      }),
    })

    const { result } = renderHook(() => useFacilityCatalogLookup())

    await waitFor(() => {
      expect(result.current.get('facility-no-field')).toBeDefined()
    })

    expect(result.current.get('facility-no-field')?.amenities).toEqual([])
  })

  it('an id absent from the resolved catalog stays undefined (not conflated with empty)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ facilities: [{ id: 'facility-1', coverPhotoUrl: null, facilityTypeName: 'Classroom', hasActiveWarning: false, avgRating: null, amenities: [] }] }),
    })

    const { result } = renderHook(() => useFacilityCatalogLookup())

    await waitFor(() => {
      expect(result.current.get('facility-1')).toBeDefined()
    })

    expect(result.current.get('facility-never-in-catalog')).toBeUndefined()
  })

  it('appends ?rental=true when rentalOnly is passed', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ facilities: [] }) })

    renderHook(() => useFacilityCatalogLookup(true))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/facilities/catalog?rental=true')
    })
  })

  it('fails silently and keeps an empty Map on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useFacilityCatalogLookup())

    // Nothing to await on success; give the rejected promise a tick to settle.
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(result.current.get('facility-1')).toBeUndefined()
  })
})
