'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import type { AvailabilityResponse, SubmitStatus, SubmitResult, FacilityOption, ActiveTerm } from '@/hooks/faculty/useReservationForm'
import type { SessionType } from '@/types/course.types'

export interface AcademicFormData {
    facility_id: string
    booking_date: string
    start_time: string
    end_time: string
    booking_purpose: string
    purpose: string
    event_name: string
    expected_attendees: string
    special_requests: string
    // Course-related fields
    booking_department_code: string
    booking_course_code: string
    session_type: SessionType | ''
}

const initialFormData: AcademicFormData = {
    facility_id: '',
    booking_date: '',
    start_time: '',
    end_time: '',
    booking_purpose: 'academic',
    purpose: '',
    event_name: '',
    expected_attendees: '',
    special_requests: '',
    booking_department_code: '',
    booking_course_code: '',
    session_type: '',
}

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

export function useAcademicBooking() {
    const { user } = useAuth()
    const [facilities, setFacilities] = useState<FacilityOption[]>([])
    const [formData, setFormData] = useState<AcademicFormData>(initialFormData)
    const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
    const [loadingFacilities, setLoadingFacilities] = useState(true)
    const [loadingAvailability, setLoadingAvailability] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof AcademicFormData, string>>>({})
    const [departmentCourses, setDepartmentCourses] = useState<DepartmentCourses[]>([])
    const [loadingCourses, setLoadingCourses] = useState(false)
    const [activeTerm, setActiveTerm] = useState<ActiveTerm | null>(null)

    // Fetch active term for date-picker constraints + validation
    useEffect(() => {
        fetch('/api/academic-terms/active')
            .then(r => r.ok ? r.json() : null)
            .then(d => setActiveTerm(d?.term ?? null))
            .catch(() => { })
    }, [])

    // Fetch facilities
    useEffect(() => {
        fetch('/api/facilities')
            .then(r => r.json())
            .then(d => setFacilities(d.facilities ?? []))
            .catch(() => { })
            .finally(() => setLoadingFacilities(false))
    }, [])

    // Fetch courses for faculty booking dropdown
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
            .catch(() => { })
            .finally(() => setLoadingCourses(false))
    }, [user?.id])

    // Fetch availability
    useEffect(() => {
        if (!formData.facility_id || !formData.booking_date) {
            setAvailability(null)
            return
        }
        setLoadingAvailability(true)
        fetch(`/api/facilities/${formData.facility_id}/availability?date=${formData.booking_date}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => setAvailability(d))
            .catch(() => setAvailability(null))
            .finally(() => setLoadingAvailability(false))
    }, [formData.facility_id, formData.booking_date])

    const updateField = useCallback(<K extends keyof AcademicFormData>(field: K, value: AcademicFormData[K], error?: string) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value }

            // When department changes, reset course and session type
            if (field === 'booking_department_code') {
                next.booking_course_code = ''
                next.session_type = ''
            }

            // When course changes, auto-set session_type for single delivery modes
            if (field === 'booking_course_code' && value) {
                const dept = departmentCourses.find(d => d.department_code === next.booking_department_code)
                const course = dept?.courses.find(c => c.course_code === value)
                if (course) {
                    if (course.delivery_mode === 'lecture') next.session_type = 'lecture'
                    else if (course.delivery_mode === 'lab') next.session_type = 'lab'
                    else next.session_type = '' // 'both' requires manual selection
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

    const validate = (): boolean => {
        const errors: Partial<Record<keyof AcademicFormData, string>> = {}
        if (!formData.facility_id) errors.facility_id = 'Select a facility'
        if (!formData.booking_date) errors.booking_date = 'Select a date'
        if (!formData.start_time) errors.start_time = 'Select a start time'
        if (!formData.end_time) errors.end_time = 'Select an end time'

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

        // Academic head regular bookings must still fall inside the active term;
        // special events are created through the dedicated events flow and are term-exempt.
        if (
            formData.booking_date &&
            !errors.booking_date &&
            activeTerm &&
            !['school_event', 'personal', 'commercial', 'community'].includes(formData.booking_purpose)
        ) {
            if (formData.booking_date < activeTerm.start_date || formData.booking_date > activeTerm.end_date) {
                errors.booking_date = `Date is outside ${activeTerm.term_name} (${activeTerm.start_date} to ${activeTerm.end_date}). For off-term use, create a special school event.`
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
                booking_department_code: formData.booking_department_code || undefined,
                booking_course_code: formData.booking_course_code || undefined,
                session_type: formData.session_type || undefined,
            }

            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            const data = await res.json()

            if (!res.ok) {
                setSubmitError(data.error ?? 'Failed to submit booking')
                setSubmitting(false)
                return
            }

            // Async path: the server runs the decision pipeline via after().
            // Release the UI instantly and let the realtime effect below resolve
            // the final decision.
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

            setSubmitResult(data as SubmitResult)
            setSubmitting(false)
        } catch {
            setSubmitError('Network error. Please try again.')
            setSubmitting(false)
        }
    }, [formData])

    // Resolve the async "processing" state to its final decision via realtime + polling.
    // Mirrors the resolution logic in useReservationForm.
    useEffect(() => {
        if (submitResult?.status !== 'processing' || !submitResult.booking_id) return
        const bookingId = submitResult.booking_id
        const supabase = createClient()

        const AUTO_TERMINAL = new Set(['auto_approved', 'approved', 'auto_declined', 'flagged', 'rejected'])

        let settled = false
        const resolve = (row: { current_status: string; pipeline_processed_at?: string | null; assigned_reviewer_role?: string | null }) => {
            if (settled) return
            const { current_status: dbStatus, pipeline_processed_at, assigned_reviewer_role } = row
            const isDecidedPending = dbStatus === 'pending' && !!pipeline_processed_at && !!assigned_reviewer_role
            if (!AUTO_TERMINAL.has(dbStatus) && !isDecidedPending) return
            settled = true
            const mapped: SubmitStatus = dbStatus === 'pending' ? 'routed_to_manual' : (dbStatus as SubmitStatus)
            setSubmitResult(prev =>
                prev && prev.status === 'processing' ? { ...prev, status: mapped, message: undefined } : prev
            )
        }

        const channel = supabase
            .channel(`booking-result-${bookingId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
                payload => resolve(payload.new as { current_status: string; pipeline_processed_at?: string | null; assigned_reviewer_role?: string | null })
            )
            .subscribe()

        const poll = setInterval(async () => {
            try {
                const res = await fetch(`/api/bookings/${bookingId}/status`)
                if (!res.ok) return
                const data = await res.json()
                if (data) resolve(data)
            } catch {
                // ignore transient fetch errors
            }
        }, 2500)

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
    }, [])

    const selectedFacility = facilities.find(f => f.id === formData.facility_id) ?? null

    // Compute available courses for selected department
    const selectedDeptCourses = useMemo(() => {
        if (!formData.booking_department_code) return []
        return departmentCourses.find(d => d.department_code === formData.booking_department_code)?.courses ?? []
    }, [formData.booking_department_code, departmentCourses])

    // Selected course delivery mode — used to decide if session_type selector is needed
    const selectedCourseDeliveryMode = useMemo(() => {
        if (!formData.booking_course_code) return null
        return selectedDeptCourses.find(c => c.course_code === formData.booking_course_code)?.delivery_mode ?? null
    }, [formData.booking_course_code, selectedDeptCourses])

    // Facility mismatch warning
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

    // Facility match good indicator (green check)
    const facilityMatchGood = useMemo(() => {
        if (!formData.session_type || !selectedFacility) return false
        const name = selectedFacility.name.toLowerCase()
        const isLabFacility = name.includes('lab') || name.includes('computer') || name.includes('clab')
        return (formData.session_type === 'lab' && isLabFacility) || (formData.session_type === 'lecture' && !isLabFacility)
    }, [formData.session_type, selectedFacility])

    return {
        facilities,
        formData,
        updateField,
        durationMinutes,
        availability,
        loadingFacilities,
        loadingAvailability,
        loadingCourses,
        submitting,
        submitResult,
        submitError,
        validationErrors,
        selectedFacility,
        departmentCourses,
        selectedDeptCourses,
        selectedCourseDeliveryMode,
        facilityMismatchWarning,
        facilityMatchGood,
        submit,
        reset,
        user,
        activeTerm,
    }
}

export type { AvailabilityResponse, SubmitStatus, SubmitResult, FacilityOption }
