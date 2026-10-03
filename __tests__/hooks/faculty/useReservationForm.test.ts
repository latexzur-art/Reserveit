import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useReservationForm } from '@/hooks/faculty/useReservationForm'

const stableToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: stableToast }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-fac-001', email: 'faculty@test.com', full_name: 'Test Faculty', user_type: 'internal' },
    signOut: vi.fn(),
    loading: false,
  }),
}))

function mockResponse(data: any, ok = true) {
  return { ok, json: () => Promise.resolve(data) }
}

const mockFacilities = [
  { id: 'f1', name: 'Room 101', room_number: '101', capacity: 40, facility_types: { name: 'Classroom' }, floors: { floor_number: 1, buildings: { name: 'Main' } } },
  { id: 'f2', name: 'Lab A', room_number: 'LA', capacity: 30, facility_types: { name: 'Laboratory' }, floors: { floor_number: 2, buildings: { name: 'Annex' } } },
]

const mockAvailability = {
  operating_hours: { open: '07:00', close: '19:00' },
  blocked_ranges: [{ start: '10:00', end: '11:00', reason: 'Maintenance' }],
}

const mockPurposeCategories = {
  categories: [
    { value: 'lecture', label: 'Lecture', isWhitelisted: true, requiresJustification: false },
    { value: 'external_event', label: 'External Event', isWhitelisted: false, requiresJustification: true },
  ],
  isSpecialized: true,
  isPrimary: false,
}

describe('useReservationForm', () => {
  const mockFetch = vi.fn()
  // Use a future date so the "no past dates" validation rule passes regardless of run time
  const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/api/facilities') && !url.includes('availability') && !url.includes('purpose-categories')) {
        return Promise.resolve(mockResponse({ facilities: mockFacilities }))
      }
      if (typeof url === 'string' && url.includes('/availability')) {
        return Promise.resolve(mockResponse(mockAvailability))
      }
      if (typeof url === 'string' && url.includes('/api/facility-purpose-categories')) {
        return Promise.resolve(mockResponse(mockPurposeCategories))
      }
      if (typeof url === 'string' && url.includes('/api/bookings') && opts?.method === 'POST') {
        return Promise.resolve(mockResponse({ status: 'auto_approved', booking_id: 'b-new', booking_reference: 'REF-NEW' }, true))
      }
      return Promise.resolve(mockResponse({}))
    })
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch facilities on mount', async () => {
    const { result } = renderHook(() => useReservationForm())

    await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

    expect(result.current.facilities).toHaveLength(2)
    expect(result.current.facilities[0].name).toBe('Room 101')
  })

  it('should update field and clear validation error', async () => {
    const { result } = renderHook(() => useReservationForm())

    await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

    act(() => {
      result.current.updateField('purpose', 'Test lecture')
    })

    expect(result.current.formData.purpose).toBe('Test lecture')
  })

  it('should compute durationMinutes correctly', async () => {
    const { result } = renderHook(() => useReservationForm())

    await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

    act(() => {
      result.current.updateField('start_time', '09:00')
      result.current.updateField('end_time', '11:00')
    })

    expect(result.current.durationMinutes).toBe(120)
  })

  it('should fetch availability when facility and date are set', async () => {
    const { result } = renderHook(() => useReservationForm())

    await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

    act(() => {
      result.current.updateField('facility_id', 'f1')
      result.current.updateField('booking_date', '2026-04-01')
    })

    await waitFor(() => expect(result.current.availability).not.toBeNull())

    expect(result.current.availability?.operating_hours.open).toBe('07:00')
    expect(result.current.availability?.blocked_ranges).toHaveLength(1)
  })

  it('should fetch purpose categories when facility changes', async () => {
    const { result } = renderHook(() => useReservationForm())

    await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

    act(() => {
      result.current.updateField('facility_id', 'f1')
    })

    await waitFor(() => expect(result.current.purposeCategories.length).toBeGreaterThan(0))

    expect(result.current.isSpecializedFacility).toBe(true)
    expect(result.current.isPrimaryDept).toBe(false)
    expect(result.current.purposeCategories).toHaveLength(2)
  })

  it('should validate required fields', async () => {
    const { result } = renderHook(() => useReservationForm())

    await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

    // Submit with empty form — should not call POST
    await act(async () => {
      await result.current.submit()
    })

    expect(result.current.validationErrors.facility_id).toBeDefined()
    expect(result.current.validationErrors.booking_date).toBeDefined()
    expect(result.current.validationErrors.start_time).toBeDefined()
    expect(result.current.validationErrors.end_time).toBeDefined()
    expect(result.current.validationErrors.purpose).toBeDefined()
    // Should NOT have called fetch for POST
    const postCalls = mockFetch.mock.calls.filter(
      ([url, opts]: any) => opts?.method === 'POST'
    )
    expect(postCalls).toHaveLength(0)
  })

  it('should validate time constraints', async () => {
    const { result } = renderHook(() => useReservationForm())

    await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

    act(() => {
      result.current.updateField('facility_id', 'f1')
      result.current.updateField('booking_date', '2026-04-01')
      result.current.updateField('start_time', '06:00')
      result.current.updateField('end_time', '20:00')
      result.current.updateField('purpose', 'Test')
      result.current.updateField('booking_purpose', 'academic')
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(result.current.validationErrors.start_time).toBeDefined()
    expect(result.current.validationErrors.end_time).toBeDefined()
  })

  it('should submit successfully with valid data', async () => {
    const { result } = renderHook(() => useReservationForm())

    await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

    act(() => {
      result.current.updateField('facility_id', 'f1')
      result.current.updateField('booking_date', futureDate)
      result.current.updateField('start_time', '09:00')
      result.current.updateField('end_time', '10:00')
      result.current.updateField('purpose', 'Lecture on algorithms')
      result.current.updateField('booking_purpose', 'academic')
    })

    // f1 is a specialized facility, so an activity category must be chosen.
    // Set it after the purpose-categories effect has loaded (it resets on facility change).
    await waitFor(() => expect(result.current.purposeCategories.length).toBeGreaterThan(0))
    act(() => {
      result.current.updateField('facility_purpose_category', 'lecture')
    })

    await act(async () => {
      await result.current.submit()
    })

    await waitFor(() => expect(result.current.submitResult).not.toBeNull())

    expect(result.current.submitResult?.status).toBe('auto_approved')
    expect(result.current.submitResult?.booking_reference).toBe('REF-NEW')
    expect(result.current.submitError).toBeNull()
  })

  it('should set submitError on failed submit', async () => {
    mockFetch.mockImplementation((url: string, opts?: any) => {
      if (typeof url === 'string' && url.includes('/api/facilities') && !url.includes('availability') && !url.includes('purpose-categories')) {
        return Promise.resolve(mockResponse({ facilities: mockFacilities }))
      }
      if (typeof url === 'string' && url.includes('/api/bookings') && opts?.method === 'POST') {
        return Promise.resolve(mockResponse({ error: 'Facility unavailable' }, false))
      }
      return Promise.resolve(mockResponse({}))
    })

    const { result } = renderHook(() => useReservationForm())

    await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

    act(() => {
      result.current.updateField('facility_id', 'f1')
      result.current.updateField('booking_date', futureDate)
      result.current.updateField('start_time', '09:00')
      result.current.updateField('end_time', '10:00')
      result.current.updateField('purpose', 'Lecture on algorithms')
      result.current.updateField('booking_purpose', 'academic')
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(result.current.submitError).toBe('Facility unavailable')
    expect(result.current.submitResult).toBeNull()
  })

  it('should reset all state', async () => {
    const { result } = renderHook(() => useReservationForm())

    await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

    act(() => {
      result.current.updateField('facility_id', 'f1')
      result.current.updateField('purpose', 'Test')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.formData.facility_id).toBe('')
    expect(result.current.formData.purpose).toBe('')
    expect(result.current.availability).toBeNull()
    expect(result.current.submitResult).toBeNull()
    expect(result.current.submitError).toBeNull()
  })
})
