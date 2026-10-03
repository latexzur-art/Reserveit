"use client"

import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { useReservationForm } from '@/hooks/faculty/useReservationForm'
import { useToast } from '@/hooks/use-toast'
import { useEffect, useRef, useState, useMemo, Suspense } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, MapPin, Clock, ArrowRight, Loader2, Check, X, Sparkles } from 'lucide-react'
import type { AlternativeSuggestion } from '@/backend/booking/booking.types'
import { TimeSlotPicker } from '@/components/ui/TimeSlotPicker'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { BOOKING_PURPOSES, JUSTIFICATIONS, MISMATCH_REASONS } from '@/components/bookings/form/constants'
import { CourseCascadeSection } from '@/components/bookings/form/CourseCascadeSection'
import { DropdownSelect } from '@/components/bookings/form/DropdownSelect'
import { DateField } from '@/components/bookings/form/DateField'
import { AvailabilitySummaryPanel } from '@/components/bookings/form/AvailabilitySummaryPanel'
import { FacilityInfoButton } from '@/components/shared/facilities/FacilityInfoButton'
import { FacilityRowThumbnail } from '@/components/shared/facilities/FacilityRowThumbnail'
import { useFacilityCatalogLookup } from '@/hooks/shared/useFacilityCatalogLookup'
import { FacilityCatalog } from '@/components/shared/facilities/FacilityCatalog'
import { FacilityWarningBannerInline } from '@/components/shared/facilities/FacilityWarningBannerInline'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function ReservationFormInner() {
  const router = useRouter()
  const { toast } = useToast()
  const {
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
    submit,
    reset,
    purposeCategories,
    isSpecializedFacility,
    isPrimaryDept,
    requiresMismatchJustification,
    departmentCourses,
    selectedDeptCourses,
    selectedCourseDeliveryMode,
    facilityMismatchWarning,
    facilityMatchGood,
    activeTerm,
    dateMin,
    dateMax,
    previewResult,
    loadingPreview,
  } = useReservationForm()

  // Searchable facility dropdown state
  const [facilityOpen, setFacilityOpen] = useState(false)
  const [facilitySearch, setFacilitySearch] = useState('')
  const [facilityHighlightedIndex, setFacilityHighlightedIndex] = useState(-1)
  const facilityRef = useRef<HTMLDivElement>(null)
  const [pageTab, setPageTab] = useState<'form' | 'browse'>('form')
  const facilityLookup = useFacilityCatalogLookup()

  // Booking Reason dropdown — local state only (auto-fills purpose, not stored in event_name)
  const [bookingReason, setBookingReason] = useState('')

  // QuickFill prefill state
  const searchParams = useSearchParams()
  const [estimatedScore, setEstimatedScore] = useState<number | null>(null)
  const [prefillNotes, setPrefillNotes] = useState<string | null>(null)
  const [prefillAttempted, setPrefillAttempted] = useState(false)
  const [pendingPrefill, setPendingPrefill] = useState<Record<string, any> | null>(null)
  const facilityAppliedRef = useRef(false)
  const coursesAppliedRef = useRef(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (facilityRef.current && !facilityRef.current.contains(e.target as Node)) {
        setFacilityOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredFacilities = useMemo(() => {
    const q = facilitySearch.toLowerCase().trim()
    if (!q) return facilities
    return facilities.filter(f =>
      (f.name ?? '').toLowerCase().includes(q) ||
      (f.room_number && f.room_number.toLowerCase().includes(q)) ||
      String(f.capacity).includes(q) ||
      (f.floors?.buildings?.name && f.floors.buildings.name.toLowerCase().includes(q))
    )
  }, [facilitySearch, facilities])

  // Reset combobox keyboard highlight whenever the option list changes or closes
  useEffect(() => {
    setFacilityHighlightedIndex(-1)
  }, [filteredFacilities, facilityOpen])

  const selectFacility = (f: typeof facilities[number]) => {
    updateField('facility_id', f.id)
    setFacilitySearch(`${f.name}${f.room_number ? ` (${f.room_number})` : ''}`)
    setFacilityOpen(false)
  }

  const handleFacilityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!facilityOpen) { setFacilityOpen(true); return }
      setFacilityHighlightedIndex(i => (i + 1 >= filteredFacilities.length ? 0 : i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!facilityOpen) { setFacilityOpen(true); return }
      setFacilityHighlightedIndex(i => (i - 1 < 0 ? filteredFacilities.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (facilityOpen && facilityHighlightedIndex >= 0 && facilityHighlightedIndex < filteredFacilities.length) {
        e.preventDefault()
        selectFacility(filteredFacilities[facilityHighlightedIndex])
      }
    } else if (e.key === 'Escape') {
      if (facilityOpen) {
        e.preventDefault()
        setFacilityOpen(false)
      }
    }
  }


  // Navigate to reservations on success
  useEffect(() => {
    console.log('[faculty-form] submitResult changed:', submitResult)
    if (!submitResult) return
    if (['auto_approved', 'flagged', 'approved', 'routed_to_manual'].includes(submitResult.status)) {
      const isApproved = ['auto_approved', 'approved'].includes(submitResult.status)
      console.log('[faculty-form] Navigating to reservations, status:', submitResult.status)
      toast({
        title: isApproved ? 'Booking Approved!' : 'Booking Submitted',
        description: submitResult.booking_reference
          ? `Reference: ${submitResult.booking_reference}`
          : 'Your booking is under review.',
      })
      setTimeout(() => router.push('/faculty/reservations'), 1500)
    }
  }, [submitResult, router, toast])

  // QuickFill: read ?prefill= param and populate form fields
  useEffect(() => {
    const prefillParam = searchParams.get('prefill')
    if (!prefillParam) return
    try {
      const prefill = JSON.parse(decodeURIComponent(prefillParam))
      if (prefill.facility_search_term && !prefill.facility_id) {
        setFacilitySearch(prefill.facility_search_term)
        setFacilityOpen(true)
      }
      if (prefill.booking_date)       updateField('booking_date', prefill.booking_date)
      if (prefill.start_time)         updateField('start_time', prefill.start_time)
      if (prefill.end_time)           updateField('end_time', prefill.end_time)
      if (prefill.booking_purpose)    updateField('booking_purpose', prefill.booking_purpose)
      if (prefill.expected_attendees) updateField('expected_attendees', prefill.expected_attendees)
      if (prefill.purpose_statement)  updateField('purpose', prefill.purpose_statement)
      if (prefill.special_requests)   updateField('special_requests', prefill.special_requests)
      if (prefill.event_name) {
        const j = JUSTIFICATIONS.find(j => j.value === prefill.event_name)
        if (j) {
          // AI sent a justification code — apply to the Booking Reason dropdown
          setBookingReason(prefill.event_name)
          if (!prefill.purpose_statement && j.purpose) updateField('purpose', j.purpose)
        } else {
          // AI sent a real event name — apply to the Event/Activity Name field
          updateField('event_name', prefill.event_name)
        }
      }
      if (typeof prefill.estimated_score === 'number') setEstimatedScore(prefill.estimated_score)
      if (prefill.notes) setPrefillNotes(prefill.notes)
      setPendingPrefill(prefill)
      setPrefillAttempted(true)
    } catch {
      console.warn('[QuickFill] Malformed prefill param, ignoring')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Apply facility_id prefill once facilities have loaded
  useEffect(() => {
    if (facilityAppliedRef.current) return
    if (!pendingPrefill || loadingFacilities) return

    let match: typeof facilities[number] | undefined

    const wantedId = pendingPrefill.facility_id
    if (wantedId && typeof wantedId === 'string') {
      match = facilities.find(f => f.id === wantedId)
    }

    if (!match) {
      const wantedName = pendingPrefill.facility_search_term
      if (wantedName && typeof wantedName === 'string') {
        const normalized = wantedName.toLowerCase().trim()
        match = facilities.find(f => f.name.toLowerCase() === normalized)
            ?? facilities.find(f => f.name.toLowerCase().includes(normalized))
            ?? facilities.find(f => normalized.includes(f.name.toLowerCase()))
      }
    }

    if (match) {
      updateField('facility_id', match.id)
      setFacilitySearch(`${match.name}${match.room_number ? ` (${match.room_number})` : ''}`)
      setFacilityOpen(false)
    }

    facilityAppliedRef.current = true
  }, [facilities, loadingFacilities, pendingPrefill, updateField])

  // Apply facility_purpose_category from prefill once purpose categories have loaded
  const purposeCatAppliedRef = useRef(false)
  useEffect(() => {
    if (purposeCatAppliedRef.current) return
    if (!pendingPrefill?.facility_purpose_category) return
    if (purposeCategories.length === 0) return
    purposeCatAppliedRef.current = true
    const match = purposeCategories.find(
      (c: { value: string }) => c.value === pendingPrefill.facility_purpose_category
    )
    if (match) updateField('facility_purpose_category', match.value)
  }, [purposeCategories, pendingPrefill, updateField])

  // Apply department / course / session_type prefill once course data has loaded
  useEffect(() => {
    if (coursesAppliedRef.current) return
    if (!pendingPrefill || loadingCourses) return
    const deptCode = pendingPrefill.department
    const courseCode = pendingPrefill.course
    const sessionType = pendingPrefill.session_type

    if (deptCode && typeof deptCode === 'string') {
      const dept = departmentCourses.find((d: any) => d.department_code === deptCode)
      if (dept) {
        updateField('booking_department_code', dept.department_code)
        if (courseCode && typeof courseCode === 'string') {
          const course = dept.courses.find((c: any) => c.course_code === courseCode)
          if (course) {
            updateField('booking_course_code', course.course_code)
            if (course.delivery_mode === 'both' && (sessionType === 'lecture' || sessionType === 'lab')) {
              updateField('session_type', sessionType)
            }
          }
        }
      }
    }
    coursesAppliedRef.current = true
  }, [departmentCourses, loadingCourses, pendingPrefill, updateField])

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      <ConnectedTopBar title="New Reservation" breadcrumbs={[{ label: 'Dashboard' }]} />

      <div className="flex-1 overflow-auto bg-gradient-to-br from-background via-background to-muted/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 py-8 px-6">
        <main className="max-w-7xl mx-auto">
          <Tabs value={pageTab} onValueChange={v => setPageTab(v as 'form' | 'browse')}>
            <TabsList className="mb-6">
              <TabsTrigger value="form">New Reservation</TabsTrigger>
              <TabsTrigger value="browse">Browse Facilities</TabsTrigger>
            </TabsList>

            <TabsContent value="browse">
              <FacilityCatalog
                onReserveSelect={(facility) => {
                  updateField('facility_id', facility.id)
                  setFacilitySearch(`${facility.name}${facility.roomNumber ? ` (${facility.roomNumber})` : ''}`)
                  setPageTab('form')
                }}
              />
            </TabsContent>

            <TabsContent value="form">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Reservation <span className="text-accent-brand">Form</span></h1>

          {/* QuickFill Score Banner */}
          {estimatedScore !== null && (
            <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Quick-Fill Applied</span>
                </div>
                <span className={`text-sm font-bold ${estimatedScore >= 80 ? 'text-green-700 dark:text-green-400' : estimatedScore >= 35 ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400'}`}>
                  {estimatedScore}/100 —{' '}
                  {estimatedScore >= 80 ? <span className="inline-flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Will auto-approve</span> : estimatedScore >= 35 ? <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-yellow-400" /> Needs admin review</span> : <span className="inline-flex items-center gap-1"><X className="w-3 h-3 text-red-400" /> Likely declined</span>}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5 mb-2">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${estimatedScore >= 80 ? 'bg-green-500' : estimatedScore >= 35 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${estimatedScore}%` }}
                />
              </div>
              {prefillNotes && <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mb-1">{prefillNotes}</p>}
              <p className="text-xs text-slate-500">*Estimated only. Actual score is calculated server-side on submit.</p>
            </div>
          )}

          {/* Facility confirmation warning */}
          {prefillAttempted && !formData.facility_id && searchParams.get('prefill') && (
            <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2">
              <p className="text-xs text-yellow-700 dark:text-yellow-400 inline-flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-yellow-500" /> Facility suggestion pre-filled — please select from the dropdown to confirm your facility.</p>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              // Guard against untyped buttons rendered by child components (e.g. the
              // "reset"/"try again" links in AvailabilitySummaryPanel) which default to
              // type="submit" inside a <form> and would otherwise trigger this handler.
              const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null
              if (submitter && submitter.getAttribute('data-form-submit') !== 'true') return
              submit()
            }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left: Form */}
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Reservation Details</h2>

                {/* Facility + Capacity */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="facility-search" className="block text-sm font-medium text-muted-foreground dark:text-slate-400">
                      Facility <span className="text-red-500">*</span>
                    </label>
                    {loadingFacilities ? (
                      <div className="mt-1 h-9 rounded-md bg-muted animate-pulse" />
                    ) : (
                      <div className="relative mt-1" ref={facilityRef}>
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                        <Input
                          id="facility-search"
                          type="text"
                          role="combobox"
                          aria-expanded={facilityOpen}
                          aria-controls="facility-listbox"
                          aria-autocomplete="list"
                          aria-activedescendant={
                            facilityOpen && facilityHighlightedIndex >= 0 && filteredFacilities[facilityHighlightedIndex]
                              ? `facility-option-${filteredFacilities[facilityHighlightedIndex].id}`
                              : undefined
                          }
                          value={facilitySearch}
                          onChange={e => {
                            setFacilitySearch(e.target.value)
                            setFacilityOpen(true)
                            if (formData.facility_id) updateField('facility_id', '')
                          }}
                          onFocus={() => setFacilityOpen(true)}
                          onKeyDown={handleFacilityKeyDown}
                          placeholder='Search rooms... e.g. "Room 2", "Lab"'
                          className={cn(
                            "pl-9 pr-8 h-9 text-sm",
                            validationErrors.facility_id && "border-red-500"
                          )}
                          autoComplete="off"
                        />
                        {formData.facility_id && (
                          <button
                            type="button"
                            onClick={() => { updateField('facility_id', ''); setFacilitySearch(''); setFacilityOpen(false) }}
                            aria-label="Clear selected facility"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          ><X className="w-4 h-4" /></button>
                        )}
                        {facilityOpen && (
                          <div
                            id="facility-listbox"
                            role="listbox"
                            aria-label="Facility results"
                            className="absolute z-50 top-full left-0 min-w-full w-max max-w-[28rem] sm:max-w-md max-w-[calc(100vw-2rem)] mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-white dark:bg-slate-800 shadow-xl p-1"
                          >
                            {filteredFacilities.length === 0 ? (
                              <div className="px-4 py-5 text-center text-sm text-muted-foreground">
                                No facilities match &quot;{facilitySearch}&quot;
                              </div>
                            ) : filteredFacilities.map((f, idx) => {
                              const isSelected = formData.facility_id === f.id
                              const isHighlighted = idx === facilityHighlightedIndex
                              return (
                                <button
                                  key={f.id}
                                  id={`facility-option-${f.id}`}
                                  role="option"
                                  aria-selected={isSelected}
                                  type="button"
                                  title={`${f.name}${f.room_number ? ` (${f.room_number})` : ''}`}
                                  onClick={() => selectFacility(f)}
                                  onMouseEnter={() => setFacilityHighlightedIndex(idx)}
                                  className={cn(
                                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 rounded-md",
                                    isSelected && "bg-primary/10 text-primary",
                                    isHighlighted && !isSelected && "bg-muted/50"
                                  )}
                                >
                                  <FacilityRowThumbnail
                                    coverPhotoUrl={facilityLookup.get(f.id)?.coverPhotoUrl}
                                    facilityTypeName={facilityLookup.get(f.id)?.facilityTypeName}
                                    hasActiveWarning={facilityLookup.get(f.id)?.hasActiveWarning}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className={cn("font-medium whitespace-normal break-words text-sm leading-snug", isSelected && "text-primary")}>
                                      {f.name}{f.room_number ? ` (${f.room_number})` : ''}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Capacity: {f.capacity}
                                      {f.floors?.buildings?.name ? ` · ${f.floors.buildings.name}` : ''}
                                      {f.floors?.floor_number ? ` · Floor ${f.floors.floor_number}` : ''}
                                    </p>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {validationErrors.facility_id && (
                      <p className="mt-1 text-xs text-red-500">{validationErrors.facility_id}</p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="facility-capacity" className="block text-sm font-medium text-muted-foreground dark:text-slate-400">Capacity</label>
                      <FacilityInfoButton
                        facility={selectedFacility ? {
                          id: selectedFacility.id,
                          name: selectedFacility.name,
                          capacity: selectedFacility.capacity,
                          buildingName: selectedFacility.floors?.buildings?.name,
                          facilityTypeName: selectedFacility.facility_types?.name,
                          amenities: facilityLookup.get(selectedFacility.id)?.amenities,
                        } : null}
                      />
                    </div>
                    <input
                      id="facility-capacity"
                      readOnly
                      value={selectedFacility ? `${selectedFacility.capacity} people` : '—'}
                      className="mt-1 block w-full border border-border/60 rounded-md bg-muted/30 dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white cursor-not-allowed opacity-70"
                    />
                  </div>
                </div>

                {/* Personal use banner for rentable facilities */}
                {selectedFacility?.is_available_for_rental && (
                  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Booking {selectedFacility.name} for personal use?</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        Personal, community, and commercial use require building head approval and payment. Use the form below for academic purposes only.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/internal/personal-gym-booking?facility_id=${selectedFacility.id}&returnUrl=/faculty/reservations`)}
                      className="shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
                    >
                      Book for Personal Use
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Facility Warnings */}
                {formData.facility_id && (
                  <div className="mt-4">
                    <FacilityWarningBannerInline facilityId={formData.facility_id} />
                  </div>
                )}

                {/* Date */}
                <div className="mt-4">
                  <label id="booking-date-label" className="block text-sm font-medium text-muted-foreground dark:text-slate-400">
                    Date <span className="text-red-500">*</span>
                  </label>
                  {activeTerm && (
                    <p className="mt-1 mb-1 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {activeTerm.term_name} &mdash; {activeTerm.start_date} to {activeTerm.end_date}
                    </p>
                  )}
                  <div role="group" aria-labelledby="booking-date-label">
                    <DateField
                      value={formData.booking_date}
                      onChange={v => updateField('booking_date', v)}
                      min={dateMin}
                      max={dateMax}
                      allowSunday={selectedFacility?.is_available_for_rental === true}
                      error={!!validationErrors.booking_date}
                      className="mt-1"
                    />
                  </div>
                  {validationErrors.booking_date && (
                    <p className="mt-1 text-xs text-red-500">{validationErrors.booking_date}</p>
                  )}
                </div>

                {/* Time Pickers — Start + End as dropdowns */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TimeSlotPicker
                    label="Select Start Time"
                    value={formData.start_time}
                    onChange={(t) => updateField('start_time', t)}
                    blockedRanges={availability?.blocked_ranges}
                    onBlockedClick={(reason) => updateField('start_time', '', reason)}
                    error={validationErrors.start_time}
                  />
                  <TimeSlotPicker
                    label="Select End Time"
                    value={formData.end_time}
                    onChange={(t) => updateField('end_time', t)}
                    blockedRanges={availability?.blocked_ranges}
                    onBlockedClick={(reason) => updateField('end_time', '', reason)}
                    minTime={formData.start_time}
                    error={validationErrors.end_time}
                  />
                </div>
                {durationMinutes > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Duration: {Math.floor(durationMinutes / 60) > 0 ? `${Math.floor(durationMinutes / 60)}h ` : ''}{durationMinutes % 60 > 0 ? `${durationMinutes % 60}m` : ''}
                  </p>
                )}
                {/* Booking Purpose + Attendees */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div className="sm:col-span-2">
                    <label id="booking-purpose-label" className="block text-sm font-medium text-muted-foreground dark:text-slate-400">
                      Booking Purpose <span className="text-red-500">*</span>
                    </label>
                    <div role="group" aria-labelledby="booking-purpose-label">
                      <DropdownSelect
                        value={formData.booking_purpose}
                        onChange={v => updateField('booking_purpose', v)}
                        options={BOOKING_PURPOSES}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="expected-attendees" className="block text-sm font-medium text-muted-foreground dark:text-slate-400">Attendees</label>
                    <input
                      id="expected-attendees"
                      type="number"
                      min={1}
                      value={formData.expected_attendees}
                      onChange={e => updateField('expected_attendees', e.target.value)}
                      placeholder="e.g. 30"
                      className={cn("mt-1 block w-full border border-border/60 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white", validationErrors.expected_attendees && "border-red-500")}
                    />
                    {validationErrors.expected_attendees && (
                      <p className="mt-1 text-xs text-red-500">{validationErrors.expected_attendees}</p>
                    )}
                  </div>
                </div>

                {/* Course Information (dynamic cascade, visible for academic purpose) */}
                <CourseCascadeSection
                  formData={formData}
                  updateField={updateField}
                  loadingCourses={loadingCourses}
                  departmentCourses={departmentCourses}
                  selectedDeptCourses={selectedDeptCourses}
                  selectedCourseDeliveryMode={selectedCourseDeliveryMode}
                  validationErrors={validationErrors}
                  facilityMismatchWarning={facilityMismatchWarning}
                  facilityMatchGood={facilityMatchGood}
                />

                {/* Facility Mismatch Detection — shown for specialized facilities not owned by requester's dept */}
                {isSpecializedFacility && !isPrimaryDept && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label id="specific-activity-label" className="block text-sm font-medium text-muted-foreground dark:text-slate-400">
                        Specific Activity <span className="text-red-500">*</span>
                      </label>
                      <p className="text-xs text-muted-foreground dark:text-slate-500 mt-0.5">
                        This is a specialized facility. Select the activity that best describes your intended use.
                      </p>
                      <div role="group" aria-labelledby="specific-activity-label">
                        <DropdownSelect
                          value={formData.facility_purpose_category}
                          onChange={v => updateField('facility_purpose_category', v)}
                          error={!!validationErrors.facility_purpose_category}
                          placeholder="— Select an activity —"
                          options={purposeCategories.map(cat => ({
                            value: cat.value,
                            label: `${cat.isWhitelisted ? '✓ ' : ''}${cat.label}`
                          }))}
                          className="mt-1"
                        />
                      </div>
                      {validationErrors.facility_purpose_category && (
                        <p className="mt-1 text-xs text-red-500">{validationErrors.facility_purpose_category}</p>
                      )}
                    </div>

                    {requiresMismatchJustification && (
                      <>
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-700 dark:text-amber-300">
                            <p className="font-medium">Activity requires review</p>
                            <p className="mt-0.5 text-xs opacity-80">
                              This activity is not in the standard whitelist for your department at this facility.
                              Your booking will be routed to the Academic Head for manual review.
                              Please provide a justification below.
                            </p>
                          </div>
                        </div>

                        <div>
                          <label id="mismatch-reason-label" className="block text-sm font-medium text-muted-foreground dark:text-slate-400">
                            Reason for using this facility <span className="text-red-500">*</span>
                          </label>
                          <div role="group" aria-labelledby="mismatch-reason-label">
                            <DropdownSelect
                              value={MISMATCH_REASONS.find(r => r.value === formData.mismatch_justification) ? formData.mismatch_justification : (formData.mismatch_justification ? 'other' : '')}
                              onChange={v => {
                                if (v === 'other') {
                                  updateField('mismatch_justification', '')
                                } else {
                                  updateField('mismatch_justification', v)
                                }
                              }}
                              options={MISMATCH_REASONS}
                              className="mt-1"
                            />
                          </div>
                          {/* Show custom text input when 'other' is selected or text doesn't match any preset */}
                          {(!MISMATCH_REASONS.find(r => r.value === formData.mismatch_justification && r.value !== '' && r.value !== 'other')) && (
                            <textarea
                              aria-labelledby="mismatch-reason-label"
                              rows={2}
                              value={formData.mismatch_justification}
                              onChange={e => updateField('mismatch_justification', e.target.value)}
                              placeholder="Explain why your department needs to use this specialized facility..."
                              className="mt-2 block w-full border border-border/60 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-muted/30 dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                          )}
                          {validationErrors.mismatch_justification && (
                            <p className="mt-1 text-xs text-red-500">{validationErrors.mismatch_justification}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <hr className="my-6 border-slate-200 dark:border-slate-700" />

                <h3 className="text-sm font-semibold mb-3 text-slate-900 dark:text-white">Event Details</h3>

                {/* Event / Activity Name */}
                <div className="mb-4">
                  <label htmlFor="event-name" className="block text-sm font-medium text-muted-foreground dark:text-slate-400">
                    Event / Activity Name
                    <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                  </label>
                  <input
                    id="event-name"
                    type="text"
                    maxLength={200}
                    value={formData.event_name}
                    onChange={e => updateField('event_name', e.target.value)}
                    placeholder="e.g. BSIT Capstone Defense, IT Dept Seminar"
                    className="mt-1 block w-full border border-border/60 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Booking Reason Dropdown */}
                <div className="mb-4">
                  <label id="booking-reason-label" className="block text-sm font-medium text-muted-foreground dark:text-slate-400">
                    Booking Reason
                    <span className="text-xs text-green-600 dark:text-green-400 ml-2 inline-flex items-center gap-1"><Sparkles className="w-3 h-3 text-amber-500" /> Helps boost approval</span>
                  </label>
                  <div role="group" aria-labelledby="booking-reason-label">
                    <DropdownSelect
                      value={bookingReason}
                      onChange={v => {
                        const j = JUSTIFICATIONS.find(j => j.value === v)
                        setBookingReason(v)
                        if (j?.purpose) updateField('purpose', j.purpose)
                      }}
                      options={JUSTIFICATIONS}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="purpose-description" className="block text-sm font-medium text-muted-foreground dark:text-slate-400">
                      Purpose / Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="purpose-description"
                      rows={2}
                      value={formData.purpose}
                      onChange={e => updateField('purpose', e.target.value)}
                      placeholder="Describe the purpose of your booking (e.g. Make-up class for BSIT 3A)"
                      className="mt-1 block w-full border border-border/60 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-muted/30 dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <div className="flex items-start justify-between gap-2 mt-1">
                      {validationErrors.purpose ? (
                        <p className="text-xs text-red-500">{validationErrors.purpose}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{formData.purpose.length === 0 ? 'A detailed description helps approval' : ''}</p>
                      )}
                      <span className={cn('text-xs shrink-0 ml-auto', formData.purpose.trim().length >= 10 ? 'text-emerald-600' : 'text-muted-foreground')}>
                        {formData.purpose.trim().length}/10 min
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label htmlFor="special-requests" className="block text-sm font-medium text-muted-foreground dark:text-slate-400">Special Requests (optional)</label>
                  <textarea
                    id="special-requests"
                    rows={3}
                    value={formData.special_requests}
                    onChange={e => updateField('special_requests', e.target.value)}
                    placeholder="e.g. Need 30-minute setup before start"
                    className="mt-1 block w-full border border-border/60 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-muted/30 dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Pre-flight UI Hint */}
                {loadingPreview && (
                  <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                      Checking constraints...
                    </p>
                  </div>
                )}
                {!loadingPreview && previewResult && (
                  <div className={cn(
                    "mt-4 p-3 rounded-lg border flex items-start gap-2",
                    previewResult.status === 'conflict' || previewResult.status === 'hard_fail' 
                      ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                      : previewResult.willDecline 
                        ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                        : previewResult.willFlag 
                          ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"
                          : "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                  )}>
                    {previewResult.status === 'conflict' || previewResult.status === 'hard_fail' || previewResult.willDecline ? (
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    ) : previewResult.willFlag ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="text-sm">
                      {previewResult.status === 'conflict' && (
                        <p className="font-semibold text-red-700 dark:text-red-300">Conflict: {previewResult.message}</p>
                      )}
                      {previewResult.status === 'hard_fail' && (
                        <p className="font-semibold text-red-700 dark:text-red-300">Policy Violation: {previewResult.message}</p>
                      )}
                      {previewResult.status === 'scored' && previewResult.willDecline && (
                        <p className="font-semibold text-red-700 dark:text-red-300">Warning: This booking is highly likely to be declined.</p>
                      )}
                      {previewResult.status === 'scored' && previewResult.willFlag && (
                        <p className="font-semibold text-yellow-700 dark:text-yellow-300">Note: Booking will require Academic Head approval.</p>
                      )}
                      {previewResult.status === 'scored' && previewResult.willAutoApprove && (
                        <p className="font-semibold text-green-700 dark:text-green-300">Facility is available and meets constraints.</p>
                      )}
                    </div>
                  </div>
                )}

                {submitError && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {submitError}
                    </p>
                  </div>
                )}

                {submitResult?.status === 'auto_declined' && (
                  <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <p className="font-medium text-red-700 dark:text-red-300">Booking Declined</p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{submitResult.reason ?? submitResult.message}</p>
                    <button type="button" onClick={reset} className="mt-3 text-sm text-red-600 dark:text-red-400 underline">
                      Try different details
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-4 py-2 rounded-md border border-border/60 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-form-submit="true"
                    disabled={submitting || submitResult?.status === 'processing'}
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-60 flex items-center gap-2"
                  >
                    {(submitting || submitResult?.status === 'processing') && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? 'Submitting...' : submitResult?.status === 'processing' ? 'Processing…' : 'Submit Request'}
                  </button>
                </div>
              </section>

              {/* Policies */}
              <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900 dark:text-white">Policies</h4>
                  <span className="text-xs text-muted-foreground dark:text-slate-400">Please review</span>
                </div>
                <ul className="mt-3 text-sm text-muted-foreground dark:text-slate-400 list-disc list-inside space-y-1">
                  <li>The applicant is responsible for any damage to the facility or equipment.</li>
                  <li>The facility must be cleaned and returned to its original condition after use.</li>
                  <li>Use of unauthorized areas is prohibited.</li>
                  <li>Excessive cancellations may result in account restrictions.</li>
                </ul>
              </section>
            </div>

            {/* Right: Availability + Summary */}
            <AvailabilitySummaryPanel
              formData={formData}
              updateField={updateField}
              submitResult={submitResult}
              availability={availability}
              loadingAvailability={loadingAvailability}
              selectedFacility={selectedFacility}
              reset={reset}
            />
          </form>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

export default function ReservationFormPage() {
  return (
    <Suspense>
      <ReservationFormInner />
    </Suspense>
  )
}
