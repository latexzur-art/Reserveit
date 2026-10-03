import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { mockAcademicHeadUser, mockUseAuth } from '../../mocks/auth'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(mockAcademicHeadUser),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

import { useAcademicBooking } from '@/hooks/academic-head/useAcademicBooking'

describe('useAcademicBooking', () => {
  const mockFetch = vi.fn()
  // Future date so the "no past dates" validation rule passes regardless of run time
  const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
    // Default: all fetches return empty
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/facilities') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ facilities: [] }) })
      }
      if (url.includes('/api/courses/faculty-courses/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ departments: [] }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should have empty formData matching initialFormData shape', async () => {
      const { result } = renderHook(() => useAcademicBooking())

      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      expect(result.current.formData.facility_id).toBe('')
      expect(result.current.formData.booking_date).toBe('')
      expect(result.current.formData.booking_purpose).toBe('academic')
      expect(result.current.formData.session_type).toBe('')
    })

    it('should have facilities=[] and availability=null', async () => {
      const { result } = renderHook(() => useAcademicBooking())

      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      expect(result.current.facilities).toEqual([])
      expect(result.current.availability).toBeNull()
    })

    it('should fetch facilities on mount', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/facilities') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ facilities: [{ id: 'f1', name: 'Room 101' }] }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ departments: [] }) })
      })

      const { result } = renderHook(() => useAcademicBooking())

      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      expect(result.current.facilities).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledWith('/api/facilities')
    })

    it('should fetch courses on mount when user exists', async () => {
      const { result } = renderHook(() => useAcademicBooking())

      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/courses/faculty-courses/')
      )
    })
  })

  describe('updateField', () => {
    it('should update a single field', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      act(() => {
        result.current.updateField('purpose', 'Lab session for CS101')
      })

      expect(result.current.formData.purpose).toBe('Lab session for CS101')
    })

    it('should clear validation errors for updated field', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      // Trigger validation to create errors
      act(() => {
        result.current.submit()
      })

      expect(Object.keys(result.current.validationErrors).length).toBeGreaterThan(0)

      act(() => {
        result.current.updateField('purpose', 'Test')
      })

      expect(result.current.validationErrors.purpose).toBeUndefined()
    })

    it('should reset course and session_type when department changes', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      act(() => {
        result.current.updateField('booking_course_code', 'CS101')
        result.current.updateField('session_type', 'lecture')
      })

      act(() => {
        result.current.updateField('booking_department_code', 'IT')
      })

      expect(result.current.formData.booking_course_code).toBe('')
      expect(result.current.formData.session_type).toBe('')
    })
  })

  describe('validate', () => {
    it('should fail when required fields are empty', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      await act(async () => {
        await result.current.submit()
      })

      expect(result.current.validationErrors.facility_id).toBeDefined()
      expect(result.current.validationErrors.booking_date).toBeDefined()
      expect(result.current.validationErrors.start_time).toBeDefined()
      expect(result.current.validationErrors.end_time).toBeDefined()
      expect(result.current.validationErrors.purpose).toBeDefined()
    })

    it('should fail when start_time before 07:00', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      act(() => {
        result.current.updateField('facility_id', 'f1')
        result.current.updateField('booking_date', '2026-04-01')
        result.current.updateField('start_time', '06:00')
        result.current.updateField('end_time', '08:00')
        result.current.updateField('purpose', 'Test')
      })

      await act(async () => {
        await result.current.submit()
      })

      expect(result.current.validationErrors.start_time).toContain('7:00 AM')
    })

    it('should fail when end_time after 19:00', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      act(() => {
        result.current.updateField('facility_id', 'f1')
        result.current.updateField('booking_date', '2026-04-01')
        result.current.updateField('start_time', '18:00')
        result.current.updateField('end_time', '20:00')
        result.current.updateField('purpose', 'Test')
      })

      await act(async () => {
        await result.current.submit()
      })

      expect(result.current.validationErrors.end_time).toContain('7:00 PM')
    })

    it('should fail when end_time <= start_time', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      act(() => {
        result.current.updateField('facility_id', 'f1')
        result.current.updateField('booking_date', '2026-04-01')
        result.current.updateField('start_time', '10:00')
        result.current.updateField('end_time', '09:00')
        result.current.updateField('purpose', 'Test')
      })

      await act(async () => {
        await result.current.submit()
      })

      expect(result.current.validationErrors.end_time).toContain('after start')
    })
  })

  describe('submit', () => {
    function fillValidForm(result: any) {
      act(() => {
        result.current.updateField('facility_id', 'f1')
        result.current.updateField('booking_date', futureDate)
        result.current.updateField('start_time', '09:00')
        result.current.updateField('end_time', '11:00')
        result.current.updateField('purpose', 'Lab session for CS101')
      })
    }

    it('should not submit when validation fails', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      await act(async () => {
        await result.current.submit()
      })

      expect(mockFetch).not.toHaveBeenCalledWith('/api/bookings', expect.anything())
    })

    it('should POST to /api/bookings with form data on valid submission', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      fillValidForm(result)

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ booking_id: 'b1', reference_number: 'REF-001' }),
      })

      await act(async () => {
        await result.current.submit()
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/bookings', expect.objectContaining({ method: 'POST' }))
      expect(result.current.submitResult).toBeTruthy()
    })

    it('should set submitError on API error', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      fillValidForm(result)

      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Facility not available' }),
      })

      await act(async () => {
        await result.current.submit()
      })

      expect(result.current.submitError).toBe('Facility not available')
    })

    it('should set submitError on network error', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      fillValidForm(result)

      mockFetch.mockRejectedValue(new Error('Network failed'))

      await act(async () => {
        await result.current.submit()
      })

      expect(result.current.submitError).toContain('Network error')
    })

    it('should set submitResult to processing when API returns processing status', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      fillValidForm(result)

      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/api/bookings') && !url.includes('status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'processing', booking_id: 'b1', booking_reference: 'REF-001' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      await act(async () => {
        await result.current.submit()
      })

      expect(result.current.submitResult?.status).toBe('processing')
      expect(result.current.submitResult?.booking_id).toBe('b1')
      expect(result.current.submitting).toBe(false)
    })

    it('should resolve processing to auto_approved via polling', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      fillValidForm(result)

      let statusCallCount = 0
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/api/bookings') && url.includes('/status')) {
          statusCallCount++
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ current_status: 'auto_approved', pipeline_processed_at: new Date().toISOString() }),
          })
        }
        if (typeof url === 'string' && url.includes('/api/bookings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: 'processing', booking_id: 'b1', booking_reference: 'REF-001' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      await act(async () => {
        await result.current.submit()
      })

      expect(result.current.submitResult?.status).toBe('processing')

      // Wait for the poll to fire and resolve
      await waitFor(() => {
        expect(result.current.submitResult?.status).toBe('auto_approved')
      }, { timeout: 10000 })

      expect(statusCallCount).toBeGreaterThan(0)
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      act(() => {
        result.current.updateField('purpose', 'Test')
        result.current.updateField('facility_id', 'f1')
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.formData.purpose).toBe('')
      expect(result.current.formData.facility_id).toBe('')
      expect(result.current.submitResult).toBeNull()
      expect(result.current.submitError).toBeNull()
    })
  })

  describe('facilityMismatchWarning', () => {
    it('should warn when lecture session in lab facility', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/facilities') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              facilities: [{ id: 'f1', name: 'Computer Lab 201' }],
            }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ departments: [] }) })
      })

      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      act(() => {
        result.current.updateField('facility_id', 'f1')
        result.current.updateField('session_type', 'lecture')
      })

      expect(result.current.facilityMismatchWarning).toContain('Lecture session')
    })

    it('should warn when lab session in non-lab facility', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/facilities') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              facilities: [{ id: 'f1', name: 'Lecture Room 301' }],
            }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ departments: [] }) })
      })

      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      act(() => {
        result.current.updateField('facility_id', 'f1')
        result.current.updateField('session_type', 'lab')
      })

      expect(result.current.facilityMismatchWarning).toContain('Lab session')
    })

    it('should return null when no session_type selected', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      expect(result.current.facilityMismatchWarning).toBeNull()
    })
  })

  describe('facilityMatchGood', () => {
    it('should return true when lab session in lab facility', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/facilities') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              facilities: [{ id: 'f1', name: 'Computer Lab 201' }],
            }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ departments: [] }) })
      })

      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      act(() => {
        result.current.updateField('facility_id', 'f1')
        result.current.updateField('session_type', 'lab')
      })

      expect(result.current.facilityMatchGood).toBe(true)
    })

    it('should return false when no session_type or facility selected', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      expect(result.current.facilityMatchGood).toBe(false)
    })
  })

  describe('computed values', () => {
    it('should compute durationMinutes', async () => {
      const { result } = renderHook(() => useAcademicBooking())
      await waitFor(() => expect(result.current.loadingFacilities).toBe(false))

      act(() => {
        result.current.updateField('start_time', '09:00')
        result.current.updateField('end_time', '11:30')
      })

      expect(result.current.durationMinutes).toBe(150)
    })

  })
})
