'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { computeBookingAmount } from '@/backend/booking/computeBookingAmount'
import type { FacilityRates } from '@/backend/admin/building'
import { useAuth } from '@/contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Facility {
  id: string
  name: string
  capacity?: number | null
  room_number?: string | null
  is_available_for_rental?: boolean
  facility_types?: { name: string } | { name: string }[] | null
}

export interface DeptCourse {
  course_code: string
  course_name: string
  delivery_mode: 'lecture' | 'lab' | 'both'
  is_assigned?: boolean
  is_elective?: boolean
  elective_type?: string | null
}

export interface DepartmentCourses {
  department_code: string
  department_name: string
  courses: DeptCourse[]
}

export interface Availability {
  blocked_ranges: { start: string; end: string; reason?: string }[]
  operating_hours: { open: string; close: string }
}

export type UseType = 'school' | 'paid'

const PH_PHONE_RE = /^((09|\+639)\d{9}|0[2-8]\d{8})$/

export function useReserveForm() {
  const searchParams = useSearchParams()
  const { user } = useAuth()

  // Pre-filled facility from room-availability "Book Now" — locked when present
  const lockedFacilityId   = searchParams.get('facility_id')   ?? null
  const lockedFacilityName = searchParams.get('facility_name') ? decodeURIComponent(searchParams.get('facility_name')!) : null
  const isFacilityLocked   = searchParams.get('locked') === '1' && !!lockedFacilityId

  // ── Facilities ──────────────────────────────────────────────────────────────
  const [facilities,        setFacilities]        = useState<Facility[]>([])
  const [loadingFacilities, setLoadingFacilities] = useState(true)
  const [facilitySearch,    setFacilitySearch]    = useState(lockedFacilityName ?? '')
  const [facilityOpen,      setFacilityOpen]      = useState(false)
  const facilityRef = useRef<HTMLDivElement>(null)

  // ── Core ────────────────────────────────────────────────────────────────────
  const [facilityId,    setFacilityId]    = useState(lockedFacilityId ?? '')
  const [useType,       setUseType]       = useState<UseType | null>(null)
  const [facilityRates, setFacilityRates] = useState<FacilityRates | null>(null)

  // ── Availability ─────────────────────────────────────────────────────────
  const [availability,        setAvailability]        = useState<Availability | null>(null)
  const [loadingAvailability, setLoadingAvailability] = useState(false)

  // ── Courses ─────────────────────────────────────────────────────────────────
  const [departmentCourses, setDepartmentCourses] = useState<DepartmentCourses[]>([])
  const [loadingCourses,    setLoadingCourses]    = useState(false)

  // ── Error tracking ──────────────────────────────────────────────────────────
  const [touched,         setTouched]         = useState<Set<string>>(new Set())
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // ── School fields ───────────────────────────────────────────────────────────
  const [bookingPurpose,            setBookingPurpose]            = useState('academic')
  const [bookingDate,               setBookingDate]               = useState('')
  const [startTime,                 setStartTime]                 = useState('')
  const [endTime,                   setEndTime]                   = useState('')
  const [purpose,                   setPurpose]                   = useState('')
  const [eventName,                 setEventName]                 = useState('')
  const [expectedAttendees,         setExpectedAttendees]         = useState('')
  const [specialRequests,           setSpecialRequests]           = useState('')
  const [selfFacilitationConfirmed, setSelfFacilitationConfirmed] = useState(false)
  const [facilitatorName,           setFacilitatorName]           = useState('')
  const [staffSearch,               setStaffSearch]               = useState('')
  const [staffList,                 setStaffList]                 = useState<{ id: string; name: string; category: string }[]>([])
  const [loadingStaff,              setLoadingStaff]              = useState(false)
  const [staffOpen,                 setStaffOpen]                 = useState(false)
  const staffRef = useRef<HTMLDivElement>(null)
  const [bookingDeptCode,           setBookingDeptCode]           = useState('')
  const [bookingCourseCode,         setBookingCourseCode]         = useState('')
  const [sessionType,               setSessionType]               = useState('')

  // ── Paid fields ─────────────────────────────────────────────────────────────
  const [paidPurpose,     setPaidPurpose]     = useState<'personal' | 'community' | 'commercial'>('personal')
  const [paidEventName,   setPaidEventName]   = useState('')
  const [paidDescription, setPaidDescription] = useState('')
  const [paidDate,        setPaidDate]        = useState('')
  const [paidStartTime,   setPaidStartTime]   = useState('')
  const [paidEndTime,     setPaidEndTime]     = useState('')
  const [paidAttendees,   setPaidAttendees]   = useState('')
  const [paidOrgName,     setPaidOrgName]     = useState('')
  const [paidContact,     setPaidContact]     = useState('')
  const [paidSpecialReqs, setPaidSpecialReqs] = useState('')
  const [addonSound,      setAddonSound]      = useState(false)
  const [addonLed,        setAddonLed]        = useState(false)

  // ── Submit state ────────────────────────────────────────────────────────────
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState<string | null>(null)
  const [successState, setSuccessState] = useState<{
    type: 'auto_approved' | 'payment_required'
    bookingReference: string
    paymentId?: string | null
  } | null>(null)

  // ── Computed ─────────────────────────────────────────────────────────────────
  const selectedFacility = facilities.find(f => f.id === facilityId) ?? null
  const isRentable        = selectedFacility?.is_available_for_rental === true
  // Show school form fields whenever the user hasn't explicitly chosen "paid"
  const showSchoolForm    = useType !== 'paid'

  const filteredFacilities = useMemo(() => {
    const q = facilitySearch.toLowerCase().trim()
    if (!q) return facilities
    return facilities.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.room_number && f.room_number.toLowerCase().includes(q))
    )
  }, [facilitySearch, facilities])

  const selectedDeptCourses = useMemo(() => {
    if (!bookingDeptCode) return []
    return departmentCourses.find(d => d.department_code === bookingDeptCode)?.courses ?? []
  }, [bookingDeptCode, departmentCourses])

  const selectedCourseDeliveryMode = useMemo(() => {
    if (!bookingCourseCode) return null
    return selectedDeptCourses.find(c => c.course_code === bookingCourseCode)?.delivery_mode ?? null
  }, [bookingCourseCode, selectedDeptCourses])

  const facilityMismatchWarning = useMemo(() => {
    if (!sessionType || !selectedFacility) return null
    const name  = selectedFacility.name.toLowerCase()
    const isLab = name.includes('lab') || name.includes('computer') || name.includes('clab')
    if (sessionType === 'lecture' && isLab)  return 'Lecture booked in a lab — may be flagged for review.'
    if (sessionType === 'lab'     && !isLab) return 'Lab session in a lecture room — ensure required equipment is available.'
    return null
  }, [sessionType, selectedFacility])

  const facilityMatchGood = useMemo(() => {
    if (!sessionType || !selectedFacility) return false
    const name  = selectedFacility.name.toLowerCase()
    const isLab = name.includes('lab') || name.includes('computer') || name.includes('clab')
    return (sessionType === 'lab' && isLab) || (sessionType === 'lecture' && !isLab)
  }, [sessionType, selectedFacility])

  const rateConfig = facilityRates ? {
    amRatePerHour: facilityRates.amRate        ?? undefined,
    pmRatePerHour: facilityRates.pmRate        ?? undefined,
    pmCutoffHour:  facilityRates.amCutoffHour,
    addonSoundFee: facilityRates.addons.find(a => a.name.toLowerCase().includes('sound'))?.amount,
    addonLedFee:   facilityRates.addons.find(a => a.name.toLowerCase().includes('led'))?.amount,
  } : undefined

  const liveCost = useMemo(() => {
    if (!paidStartTime || !paidEndTime) return { amount: 0, breakdown: [], hasTime: false }
    const { amount, breakdown } = computeBookingAmount(
      paidStartTime, paidEndTime,
      { sound: addonSound, led: addonLed },
      rateConfig,
    )
    return { amount, breakdown, hasTime: true }
  }, [paidStartTime, paidEndTime, addonSound, addonLed, rateConfig])

  const soundAddon    = facilityRates?.addons.find(a => a.name.toLowerCase().includes('sound'))
  const ledAddon      = facilityRates?.addons.find(a => a.name.toLowerCase().includes('led'))
  const amRate        = facilityRates?.amRate       ?? 580
  const pmRate        = facilityRates?.pmRate       ?? 780
  const amCutoff      = facilityRates?.amCutoffHour ?? 17
  const amCutoffLabel = `${amCutoff > 12 ? amCutoff - 12 : amCutoff}:00 ${amCutoff >= 12 ? 'PM' : 'AM'}`

  const today = new Date().toISOString().slice(0, 10)

  const filteredStaff = staffList.filter(s =>
    !staffSearch || s.name.toLowerCase().includes(staffSearch.toLowerCase())
  )

  // ── Data fetching ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/facilities?all=true')
      .then(r => r.ok ? r.json() : { facilities: [] })
      .then(d => setFacilities(d.facilities ?? []))
      .catch(() => setFacilities([]))
      .finally(() => setLoadingFacilities(false))
  }, [])

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
              ...(d.other_courses    ?? []).map((c: any) => ({ ...c, is_assigned: false })),
            ],
          })))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCourses(false))
  }, [user?.id])

  useEffect(() => {
    if (!facilityId || !isRentable) { setFacilityRates(null); return }
    fetch(`/api/facilities/${facilityId}/rates`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setFacilityRates(d))
      .catch(() => setFacilityRates(null))
  }, [facilityId, isRentable])

  useEffect(() => {
    const activeDate = useType === 'paid' ? paidDate : bookingDate
    if (!facilityId || !activeDate) { setAvailability(null); return }
    setLoadingAvailability(true)
    fetch(`/api/facilities/${facilityId}/availability?date=${activeDate}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setAvailability(d))
      .catch(() => setAvailability(null))
      .finally(() => setLoadingAvailability(false))
  }, [facilityId, bookingDate, paidDate, useType])

  useEffect(() => { setUseType(null); setTouched(new Set()); setSubmitAttempted(false) }, [facilityId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (facilityRef.current && !facilityRef.current.contains(e.target as Node))
        setFacilityOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (staffRef.current && !staffRef.current.contains(e.target as Node))
        setStaffOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch staff directory once
  useEffect(() => {
    setLoadingStaff(true)
    fetch('/api/admin/building/directory?pageSize=200&status=active')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setStaffList((d.items ?? []).filter((p: any) => p.category !== 'external_client').map((p: any) => ({ id: p.id, name: p.name, category: p.category }))))
      .catch(() => {})
      .finally(() => setLoadingStaff(false))
  }, [])

  // ── Validation ──────────────────────────────────────────────────────────────
  const schoolErrors = useMemo(() => {
    const e: Record<string, string> = {}
    if (!facilityId)  e.facilityId  = 'Please select a facility.'
    if (!bookingDate) e.bookingDate = 'Date is required.'
    else if (bookingDate < today) e.bookingDate = 'Booking date cannot be in the past.'
    else if (new Date(`${bookingDate}T00:00:00`).getDay() === 0) e.bookingDate = 'Sundays are not available for internal bookings.'
    if (!startTime)   e.startTime   = 'Start time is required.'
    if (!endTime)     e.endTime     = 'End time is required.'
    if (startTime && endTime && endTime <= startTime) e.endTime = 'End time must be after start time.'
    if (!purpose.trim())              e.purpose = 'Purpose description is required.'
    else if (purpose.trim().length < 10) e.purpose = 'At least 10 characters required.'
    if (expectedAttendees) {
      const n = parseInt(expectedAttendees, 10)
      if (isNaN(n) || n < 1) e.expectedAttendees = 'Enter a valid number.'
    }
    if (bookingCourseCode && selectedCourseDeliveryMode === 'both' && !sessionType)
      e.sessionType = 'Select a session type.'
    return e
  }, [facilityId, bookingDate, startTime, endTime, purpose, expectedAttendees, bookingCourseCode, selectedCourseDeliveryMode, sessionType])

  const paidErrors = useMemo(() => {
    const e: Record<string, string> = {}
    if (!facilityId)              e.facilityId      = 'Please select a facility.'
    if (!paidEventName.trim())    e.paidEventName   = 'Event / Activity name is required.'
    if (!paidDescription.trim())  e.paidDescription = 'Description is required.'
    else if (paidDescription.trim().length < 10) e.paidDescription = 'At least 10 characters required.'
    if (!paidDate)                e.paidDate        = 'Date is required.'
    else if (paidDate < today)    e.paidDate        = 'Booking date cannot be in the past.'
    if (!paidStartTime)           e.paidStartTime   = 'Start time is required.'
    if (!paidEndTime)             e.paidEndTime     = 'End time is required.'
    if (paidStartTime && paidEndTime && paidEndTime <= paidStartTime)
      e.paidEndTime = 'End time must be after start time.'
    if (paidContact.trim()) {
      const cleaned = paidContact.replace(/[-\s()]/g, '')
      if (!PH_PHONE_RE.test(cleaned)) e.paidContact = 'Invalid Philippine phone format.'
    }
    if (paidAttendees) {
      const n = parseInt(paidAttendees, 10)
      if (isNaN(n) || n < 1) e.paidAttendees = 'Enter a valid number.'
      else if (n > 200)       e.paidAttendees = 'Maximum capacity is 200.'
    }
    return e
  }, [facilityId, paidEventName, paidDescription, paidDate, paidStartTime, paidEndTime, paidContact, paidAttendees])

  const activeErrors = useType === 'paid' ? paidErrors : schoolErrors

  function err(key: string): string | undefined {
    return (touched.has(key) || submitAttempted) ? activeErrors[key] : undefined
  }
  function touch(...keys: string[]) {
    setTouched(prev => { const n = new Set(prev); keys.forEach(k => n.add(k)); return n })
  }

  const activeDate = useType === 'paid' ? paidDate : bookingDate

  return {
    // locked facility info
    lockedFacilityId,
    lockedFacilityName,
    isFacilityLocked,

    // state
    facilities,
    loadingFacilities,
    facilitySearch,       setFacilitySearch,
    facilityOpen,         setFacilityOpen,
    facilityRef,

    facilityId,           setFacilityId,
    useType,              setUseType,
    facilityRates,

    availability,
    loadingAvailability,

    departmentCourses,
    loadingCourses,

    touched,
    submitAttempted,      setSubmitAttempted,
    setTouched,

    bookingPurpose,       setBookingPurpose,
    bookingDate,          setBookingDate,
    startTime,            setStartTime,
    endTime,              setEndTime,
    purpose,              setPurpose,
    eventName,            setEventName,
    expectedAttendees,    setExpectedAttendees,
    specialRequests,      setSpecialRequests,
    selfFacilitationConfirmed, setSelfFacilitationConfirmed,
    facilitatorName,      setFacilitatorName,
    staffSearch,          setStaffSearch,
    staffList,
    loadingStaff,
    staffOpen,            setStaffOpen,
    staffRef,
    bookingDeptCode,      setBookingDeptCode,
    bookingCourseCode,    setBookingCourseCode,
    sessionType,          setSessionType,

    paidPurpose,          setPaidPurpose,
    paidEventName,        setPaidEventName,
    paidDescription,      setPaidDescription,
    paidDate,             setPaidDate,
    paidStartTime,        setPaidStartTime,
    paidEndTime,          setPaidEndTime,
    paidAttendees,        setPaidAttendees,
    paidOrgName,          setPaidOrgName,
    paidContact,          setPaidContact,
    paidSpecialReqs,      setPaidSpecialReqs,
    addonSound,           setAddonSound,
    addonLed,             setAddonLed,

    submitting,           setSubmitting,
    submitError,          setSubmitError,
    successState,         setSuccessState,

    // derived
    selectedFacility,
    isRentable,
    showSchoolForm,
    filteredFacilities,
    selectedDeptCourses,
    selectedCourseDeliveryMode,
    facilityMismatchWarning,
    facilityMatchGood,
    rateConfig,
    liveCost,
    soundAddon,
    ledAddon,
    amRate,
    pmRate,
    amCutoffLabel,
    today,
    filteredStaff,
    activeErrors,
    activeDate,
    err,
    touch,
  }
}
