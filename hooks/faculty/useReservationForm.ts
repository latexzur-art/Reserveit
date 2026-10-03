'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { getManilaTodayISO } from '@/lib/timezone'
import { earliestBookableDate, DEFAULT_MIN_LEAD_DAYS } from '@/lib/reservation-lead-time'
// Re-export types from booking.types for UI usage
import type { AvailabilityResponse, AlternativeSuggestion } from '@/backend/booking/booking.types'
import type { SessionType } from '@/types/course.types'
export type { AvailabilityResponse, AlternativeSuggestion }

interface CourseOption {
  course_code: string
  course_name: string
  delivery_mode: 'lecture' | 'lab' | 'both'
  is_assigned?: boolean
  is_elective?: boolean
  elective_type?: string | null
}

interface DepartmentCourses {
  department_code: string
  department_name: string
  courses: CourseOption[]
}

export interface FacilityOption {
  id: string
  name: string
  room_number: string
  capacity: number
  is_available_for_rental?: boolean
  floors?: { floor_number: number; buildings?: { name: string } }
  facility_types?: { name: string }
}

export interface PurposeCategory {
  value: string
  label: string
  isWhitelisted: boolean
  requiresJustification: boolean
}

export interface FormData {
  facility_id: string
  booking_date: string
  start_time: string
  end_time: string
  booking_purpose: string
  purpose: string
  event_name: string
  expected_attendees: string
  special_requests: string
  facility_purpose_category: string
  mismatch_justification: string
  booking_course_code: string
  booking_department_code: string
  session_type: SessionType | ''
}

const initialFormData: FormData = {
  facility_id: '',
  booking_date: '',
  start_time: '',
  end_time: '',
  booking_purpose: 'academic',
  purpose: '',
  event_name: '',
  expected_attendees: '',
  special_requests: '',
  facility_purpose_category: '',
  mismatch_justification: '',
  booking_course_code: '',
  booking_department_code: '',
  session_type: '',
}

export type SubmitStatus =
  | 'auto_approved'
  | 'flagged'
  | 'approved'
  | 'auto_declined'
  | 'hard_constraint_failed'
  | 'routed_to_manual'
  | 'processing'
  | 'still_processing'

export interface SubmitResult {
  status: SubmitStatus
  booking_id?: string
  booking_reference?: string
  score?: number
  failed_code?: string
  is_reroutable?: boolean
  message?: string
  suggestions?: AlternativeSuggestion[]
  reason?: string
}

export interface ActiveTerm {
  id: string
  term_code: string
  term_name: string
  academic_year: string
  term_type: string
  start_date: string
  end_date: string
  enrollment_start: string | null
  enrollment_end: string | null
  exam_start: string | null
  exam_end: string | null
}

// Determines whether a booking_purpose requires the date to be inside the active term.
// School events (handled via the dedicated special-event flow) and gym/external purposes are exempt.
function requiresTermBound(purpose: string): boolean {
  return !['school_event', 'personal', 'commercial', 'community'].includes(purpose)
}

export function useReservationForm() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [facilities, setFacilities] = useState<FacilityOption[]>([])
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [loadingFacilities, setLoadingFacilities] = useState(true)
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [activeTerm, setActiveTerm] = useState<ActiveTerm | null>(null)
  // Building-admin-set minimum advance-notice floor (Sundays excluded).
  const [leadDays, setLeadDays] = useState<number>(DEFAULT_MIN_LEAD_DAYS)

  const [previewResult, setPreviewResult] = useState<any | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Mismatch detection state
  const [purposeCategories, setPurposeCategories] = useState<PurposeCategory[]>([])
  const [isSpecializedFacility, setIsSpecializedFacility] = useState(false)
  const [isPrimaryDept, setIsPrimaryDept] = useState(false)

  // Dynamic course state
  const [departmentCourses, setDepartmentCourses] = useState<DepartmentCourses[]>([])
  const [loadingCourses, setLoadingCourses] = useState(false)

  // Fetch active term once on mount for date-picker constraints + validation
  useEffect(() => {
    fetch('/api/academic-terms/active')
      .then(r => r.ok ? r.json() : null)
      .then(d => setActiveTerm(d?.term ?? null))
      .catch(() => {})
  }, [])

  // Fetch the minimum advance-notice policy once on mount. Falls back to the
  // default if the request fails or the field is missing.
  useEffect(() => {
    fetch('/api/settings/schedule-policy')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.min_reservation_lead_days === 'number') setLeadDays(d.min_reservation_lead_days) })
      .catch(() => {})
  }, [])

  // Fetch facilities on mount
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/facilities', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => setFacilities(d.facilities ?? []))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        toast({ title: 'Failed to load facilities', description: 'Please refresh the page.', variant: 'destructive' })
      })
      .finally(() => setLoadingFacilities(false))
    return () => controller.abort()
  }, [toast])

  // Fetch availability when facility + date change
  useEffect(() => {
    if (!formData.facility_id || !formData.booking_date) {
      setAvailability(null)
      return
    }
    const controller = new AbortController()
    setLoadingAvailability(true)
    fetch(`/api/facilities/${formData.facility_id}/availability?date=${formData.booking_date}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => setAvailability(d))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setAvailability(null)
      })
      .finally(() => setLoadingAvailability(false))
    return () => controller.abort()
  }, [formData.facility_id, formData.booking_date])

  // Fetch purpose categories when facility changes (for mismatch detection)
  useEffect(() => {
    if (!formData.facility_id) {
      setPurposeCategories([])
      setIsSpecializedFacility(false)
      setIsPrimaryDept(false)
      return
    }
    const controller = new AbortController()
    fetch(`/api/facility-purpose-categories?facilityId=${formData.facility_id}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setPurposeCategories(d.categories ?? [])
          setIsSpecializedFacility(d.isSpecialized ?? false)
          setIsPrimaryDept(d.isPrimary ?? false)
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setPurposeCategories([])
        setIsSpecializedFacility(false)
        setIsPrimaryDept(false)
      })
    // Reset mismatch fields when facility changes
    setFormData(prev => ({ ...prev, facility_purpose_category: '', mismatch_justification: '' }))
    return () => controller.abort()
  }, [formData.facility_id])

  // Fetch courses for dynamic dept/course cascade
  useEffect(() => {
    if (!user?.id) return
    setLoadingCourses(true)
    fetch(`/api/courses/faculty-courses/${user.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.departments) {
          setDepartmentCourses(data.departments.map((d: any) => ({
            department_code: d.department_code,
            department_name: d.department_name,
            courses: [
              ...(d.assigned_courses ?? []).map((c: any) => ({ ...c, is_assigned: true })),
              ...(d.other_courses ?? []).map((c: any) => ({ ...c, is_assigned: false })),
            ],
          })))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCourses(false))
  }, [user?.id])

  // Pre-flight preview validation (Phase 1)
  useEffect(() => {
    const f = formData
    if (!f.facility_id || !f.booking_date || !f.start_time || !f.end_time || !f.booking_purpose) {
      setPreviewResult(null)
      return
    }

    const timer = setTimeout(() => {
      const controller = new AbortController()
      setLoadingPreview(true)

      const body: any = {
        facility_id: f.facility_id,
        booking_date: f.booking_date,
        start_time: f.start_time,
        end_time: f.end_time,
        booking_purpose: f.booking_purpose,
        purpose: f.purpose,
        event_name: f.event_name,
        expected_attendees: f.expected_attendees ? parseInt(f.expected_attendees, 10) : undefined,
        special_requests: f.special_requests,
        facility_purpose_category: f.facility_purpose_category,
        mismatch_justification: f.mismatch_justification,
        booking_course_code: f.booking_course_code,
        booking_department_code: f.booking_department_code,
        session_type: f.session_type,
      }

      fetch('/api/bookings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.status !== 'insufficient') {
          setPreviewResult(data)
        } else {
          setPreviewResult(null)
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') setPreviewResult(null)
      })
      .finally(() => setLoadingPreview(false))

      // Clean up abort on dismount/new req
      return () => controller.abort()
    }, 500)

    return () => clearTimeout(timer)
  }, [
    formData.facility_id, formData.booking_date, formData.start_time, formData.end_time, formData.booking_purpose,
    formData.purpose, formData.event_name, formData.expected_attendees, formData.special_requests, 
    formData.facility_purpose_category, formData.mismatch_justification, formData.booking_course_code, 
    formData.booking_department_code, formData.session_type
  ])

  const updateField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K], error?: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      // Cascade reset when dept changes
      if (field === 'booking_department_code') {
        next.booking_course_code = ''
        next.session_type = ''
      }
      // Auto-detect session_type from delivery_mode when course changes
      if (field === 'booking_course_code' && value) {
        const dept = departmentCourses.find(d => d.department_code === next.booking_department_code)
        const course = dept?.courses.find(c => c.course_code === value)
        if (course) {
          if (course.delivery_mode === 'lecture') next.session_type = 'lecture'
          else if (course.delivery_mode === 'lab') next.session_type = 'lab'
          else next.session_type = ''
        }
      }
      return next
    })
    setValidationErrors(prev => ({ ...prev, [field]: error }))
  }, [departmentCourses])

  const timeToMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  const durationMinutes = useMemo(() => {
    if (!formData.start_time || !formData.end_time) return 0
    return timeToMinutes(formData.end_time) - timeToMinutes(formData.start_time)
  }, [formData.start_time, formData.end_time])

  // Derived mismatch state
  const selectedPurposeCategory = purposeCategories.find(c => c.value === formData.facility_purpose_category) ?? null
  const requiresMismatchJustification = !!selectedPurposeCategory && !selectedPurposeCategory.isWhitelisted

  const validate = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.facility_id) errors.facility_id = 'Select a facility'
    if (!formData.booking_date) errors.booking_date = 'Select a date'
    if (!formData.start_time) errors.start_time = 'Select a start time'
    if (!formData.end_time) errors.end_time = 'Select an end time'
    if (!formData.booking_purpose) errors.booking_purpose = 'Select a booking purpose'

    if (!formData.purpose.trim()) errors.purpose = 'Enter a purpose'
    else if (formData.purpose.trim().length < 10) errors.purpose = 'Purpose must be at least 10 characters'

    if (formData.start_time && formData.start_time < '07:00') {
      errors.start_time = 'Start time must be 7:00 AM or later'
    }
    if (formData.start_time && formData.start_time > '19:00') {
      errors.start_time = 'Start time must be 7:00 PM or earlier'
    }
    if (formData.end_time && formData.end_time > '19:00') {
      errors.end_time = 'Booking must end by 7:00 PM'
    }
    if (formData.start_time && formData.end_time && formData.end_time <= formData.start_time) {
      errors.end_time = 'End time must be after start time'
    }

    if (formData.expected_attendees) {
      const n = parseInt(formData.expected_attendees, 10)
      if (isNaN(n) || n < 1) errors.expected_attendees = 'Enter a valid number of attendees'
    }

    if (formData.booking_course_code) {
      const dept = departmentCourses.find(d => d.department_code === formData.booking_department_code)
      const course = dept?.courses.find(c => c.course_code === formData.booking_course_code)
      if (course?.delivery_mode === 'both' && !formData.session_type)
        errors.session_type = 'Select a session type (Lecture or Lab)'
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    if (formData.booking_date && formData.booking_date < todayStr)
      errors.booking_date = 'Booking date cannot be in the past'

    // Advance-notice floor: non-paid facilities need N days' lead time (Sundays
    // excluded). Mirrors the server MIN_ADVANCE_NOTICE check; paid facilities exempt.
    const isPaidFacility = facilities.find(f => f.id === formData.facility_id)?.is_available_for_rental === true
    if (formData.booking_date && !errors.booking_date && !isPaidFacility) {
      const dayOfWeek = new Date(`${formData.booking_date}T00:00:00`).getDay()
      if (dayOfWeek === 0) {
        errors.booking_date = 'Sundays are not available for standard facility bookings.'
      } else {
        const earliest = earliestBookableDate(getManilaTodayISO(), leadDays)
        if (formData.booking_date < earliest) {
          errors.booking_date = `Reservations require at least ${leadDays} day(s) advance notice (Sundays excluded). Earliest date: ${earliest}.`
        }
      }
    }

    // Active-term check: academic/department bookings must fall inside the current semester
    if (
      formData.booking_date &&
      !errors.booking_date &&
      activeTerm &&
      requiresTermBound(formData.booking_purpose)
    ) {
      if (formData.booking_date < activeTerm.start_date || formData.booking_date > activeTerm.end_date) {
        errors.booking_date = `Date is outside ${activeTerm.term_name} (${activeTerm.start_date} to ${activeTerm.end_date}). For off-term use, request a special school event.`
      }
    }

    // Mismatch validation: specialized facilities require a specific activity selection
    if (isSpecializedFacility && !isPrimaryDept) {
      if (!formData.facility_purpose_category) {
        errors.facility_purpose_category = 'Select the specific activity for this facility'
      } else if (requiresMismatchJustification && !formData.mismatch_justification.trim()) {
        errors.mismatch_justification = 'Please provide a justification for using this facility'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = useCallback(async () => {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError(null)
    setSubmitResult(null)

    try {
      const body: Record<string, unknown> = {
        facility_id: formData.facility_id,
        booking_date: formData.booking_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        booking_purpose: formData.booking_purpose,
        purpose: formData.purpose.trim(),
        event_name: formData.event_name.trim() || undefined,
        expected_attendees: formData.expected_attendees
          ? parseInt(formData.expected_attendees, 10)
          : undefined,
        special_requests: formData.special_requests.trim() || undefined,
      }

      if (formData.facility_purpose_category) {
        body.facility_purpose_category = formData.facility_purpose_category
      }
      if (formData.mismatch_justification.trim()) {
        body.mismatch_justification = formData.mismatch_justification.trim()
      }
      if (formData.booking_course_code) {
        body.booking_course_code = formData.booking_course_code
      }
      if (formData.booking_department_code) {
        body.booking_department_code = formData.booking_department_code
      }
      if (formData.session_type) {
        body.session_type = formData.session_type
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        const baseError = data.error ?? 'Failed to submit booking'
        const ref = data.conflicting_booking_reference ?? data.booking_reference
        setSubmitError(res.status === 409 && ref ? `${baseError} (conflicts with ${ref})` : baseError)
        setSubmitting(false)
        return
      }

      // Async path: the server runs the decision pipeline via after() (guaranteed,
      // no client fire-and-forget needed). Release the UI instantly and let the
      // realtime effect below resolve the final decision.
      if (data.status === 'processing' && data.booking_id) {
        setSubmitResult({
          status: 'processing',
          booking_id: data.booking_id,
          booking_reference: data.booking_reference,
          message: 'Booking received! Awaiting decision…',
        })
        setSubmitting(false)
        return
      }

      setSubmitResult(data as unknown as SubmitResult)
      setSubmitting(false)
    } catch {
      setSubmitError('Network error. Please try again.')
      setSubmitting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isSpecializedFacility, isPrimaryDept, requiresMismatchJustification])

  // Resolve the async "processing" state to its final decision without a manual refresh.
  // The server pipeline flips current_status; we listen over realtime and fall back to a
  // short poll (covers the case where the row is decided before the subscription attaches,
  // or realtime replication isn't available).
  useEffect(() => {
    if (submitResult?.status !== 'processing' || !submitResult.booking_id) return
    const bookingId = submitResult.booking_id
    const supabase = createClient()

    // DB statuses that mean "the pipeline is done deciding".
    // 'pending' is ambiguous — the row is inserted as 'pending' BEFORE the async
    // pipeline decides, and the idempotency claim (pipeline_processed_at) is set
    // while current_status is still 'pending', so a bare 'pending' read during that
    // window is pre-decision, not a result. It only becomes a real terminal outcome
    // when the pipeline has actually routed it to manual review (restricted user),
    // which is the one case that leaves current_status='pending' post-decision — and
    // that case always sets assigned_reviewer_role (see F9). Gate on both markers so
    // we never report "routed to manual review" for a booking that's about to
    // auto-approve. (F12)
    const AUTO_TERMINAL = new Set(['auto_approved', 'approved', 'auto_declined', 'flagged', 'rejected'])

    let settled = false
    const resolve = (row: { current_status: string; pipeline_processed_at?: string | null; assigned_reviewer_role?: string | null }) => {
      if (settled) return
      const { current_status: dbStatus, pipeline_processed_at, assigned_reviewer_role } = row
      const isDecidedPending = dbStatus === 'pending' && !!pipeline_processed_at && !!assigned_reviewer_role
      console.log('[booking-resolve] dbStatus:', dbStatus, 'pipeline_processed_at:', pipeline_processed_at, 'isDecidedPending:', isDecidedPending, 'AUTO_TERMINAL:', AUTO_TERMINAL.has(dbStatus))
      if (!AUTO_TERMINAL.has(dbStatus) && !isDecidedPending) return
      settled = true
      const mapped: SubmitStatus = dbStatus === 'pending' ? 'routed_to_manual' : (dbStatus as SubmitStatus)
      console.log('[booking-resolve] RESOLVED to:', mapped)
      setSubmitResult(prev =>
        prev && prev.status === 'processing' ? { ...prev, status: mapped, message: undefined } : prev
      )
    }

    const channel = supabase
      .channel(`booking-result-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
        payload => {
          console.log('[booking-realtime] Received UPDATE:', payload.new)
          resolve(payload.new as { current_status: string; pipeline_processed_at?: string | null; assigned_reviewer_role?: string | null })
        }
      )
      .subscribe((status) => {
        console.log('[booking-realtime] Subscription status:', status)
      })

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}/status`)
        if (!res.ok) {
          console.warn('[booking-poll] API error:', res.status)
          return
        }
        const data = await res.json()
        if (data) {
          console.log('[booking-poll] Status:', data.current_status, 'pipeline_processed_at:', data.pipeline_processed_at)
          resolve(data)
        }
      } catch (e) {
        console.warn('[booking-poll] Fetch error:', e)
      }
    }, 2500)

    // F8: after 30s without a resolution (slow cold-start pipeline, or realtime
    // replication unavailable), stop polling but don't leave an indefinite spinner —
    // swap to an explicit "still processing, check My Reservations" state instead of
    // silently going stale.
    const timeout = setTimeout(() => {
      clearInterval(poll)
      if (!settled) {
        setSubmitResult(prev =>
          prev && prev.status === 'processing' ? { ...prev, status: 'still_processing', message: undefined } : prev
        )
      }
    }, 30_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
      clearTimeout(timeout)
    }
  }, [submitResult?.status, submitResult?.booking_id])

  const reset = useCallback(() => {
    setFormData(initialFormData)
    setAvailability(null)
    setSubmitResult(null)
    setSubmitError(null)
    setValidationErrors({})
    setPurposeCategories([])
    setIsSpecializedFacility(false)
    setIsPrimaryDept(false)
    // Note: departmentCourses is not reset — it's fetched once on mount
  }, [])

  const selectedFacility = facilities.find(f => f.id === formData.facility_id) ?? null

  const selectedDeptCourses = useMemo(() => {
    if (!formData.booking_department_code) return []
    return departmentCourses.find(d => d.department_code === formData.booking_department_code)?.courses ?? []
  }, [formData.booking_department_code, departmentCourses])

  const selectedCourseDeliveryMode = useMemo(() => {
    if (!formData.booking_course_code) return null
    return selectedDeptCourses.find(c => c.course_code === formData.booking_course_code)?.delivery_mode ?? null
  }, [formData.booking_course_code, selectedDeptCourses])

  const facilityMismatchWarning = useMemo(() => {
    if (!formData.session_type || !selectedFacility) return null
    const name = selectedFacility.name.toLowerCase()
    const isLabFacility = name.includes('lab') || name.includes('computer') || name.includes('clab')
    if (formData.session_type === 'lecture' && isLabFacility) {
      return 'Lecture session booked in a lab facility — this may be flagged for review.'
    }
    if (formData.session_type === 'lab' && !isLabFacility) {
      return 'Lab session booked in a lecture room — ensure the room has required equipment.'
    }
    return null
  }, [formData.session_type, selectedFacility])

  const facilityMatchGood = useMemo(() => {
    if (!formData.session_type || !selectedFacility) return false
    const name = selectedFacility.name.toLowerCase()
    const isLabFacility = name.includes('lab') || name.includes('computer') || name.includes('clab')
    return (formData.session_type === 'lab' && isLabFacility) || (formData.session_type === 'lecture' && !isLabFacility)
  }, [formData.session_type, selectedFacility])

  // Date-picker bounds. `dateMin` is the later of the term-start bound and the
  // advance-notice floor; paid/rental facilities are exempt from the floor.
  const dateMin = useMemo(() => {
    const todayISO = getManilaTodayISO()
    const base = activeTerm && requiresTermBound(formData.booking_purpose) ? activeTerm.start_date : todayISO
    const isPaid = selectedFacility?.is_available_for_rental === true
    const floor = isPaid ? todayISO : earliestBookableDate(todayISO, leadDays)
    return base > floor ? base : floor
  }, [activeTerm, formData.booking_purpose, selectedFacility, leadDays])

  const dateMax = useMemo(
    () => (activeTerm && requiresTermBound(formData.booking_purpose) ? activeTerm.end_date : undefined),
    [activeTerm, formData.booking_purpose]
  )

  return {
    facilities,
    formData,
    updateField,
    durationMinutes,
    availability,
    loadingFacilities,
    loadingAvailability,
    submitting,
    submitResult,
    submitError,
    validationErrors,
    selectedFacility,
    submit,
    reset,
    // Mismatch detection
    purposeCategories,
    isSpecializedFacility,
    isPrimaryDept,
    selectedPurposeCategory,
    requiresMismatchJustification,
    // Dynamic course cascade
    departmentCourses,
    selectedDeptCourses,
    selectedCourseDeliveryMode,
    facilityMismatchWarning,
    facilityMatchGood,
    loadingCourses,
    user,
    // Active term — for date-picker min/max and term banner in the UI
    activeTerm,
    // Date-picker bounds (term window + advance-notice floor, paid-exempt)
    dateMin,
    dateMax,
    previewResult,
    loadingPreview,
  }
}
