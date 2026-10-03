'use client'

import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Info } from 'lucide-react'
import { ReserveSidePanel } from './_components/ReserveSidePanel'
import { ReserveSuccessScreen } from './_components/ReserveSuccessScreen'
import { ReserveFormReservationDetails } from './_components/ReserveFormReservationDetails'
import { ReserveFormEventDetails } from './_components/ReserveFormEventDetails'
import { ReserveFormPaidDetails } from './_components/ReserveFormPaidDetails'
import { useReserveForm } from '@/hooks/admin/useReserveForm'

const SCHOOL_PURPOSE_OPTIONS = [
  { value: 'academic',       label: 'Academic / Class'  },
  { value: 'school_event',   label: 'School Event'      },
  { value: 'department_use', label: 'Department Use'    },
]

function BuildingAdminReservePageInner() {
  const form = useReserveForm()

  const {
    lockedFacilityId, lockedFacilityName, isFacilityLocked,
    facilities, loadingFacilities, facilitySearch, setFacilitySearch, facilityOpen, setFacilityOpen, facilityRef,
    facilityId, setFacilityId, useType, setUseType,
    availability, loadingAvailability,
    departmentCourses, loadingCourses,
    touched, submitAttempted, setSubmitAttempted, setTouched,
    bookingPurpose, setBookingPurpose,
    bookingDate, setBookingDate,
    startTime, setStartTime,
    endTime, setEndTime,
    purpose, setPurpose,
    eventName, setEventName,
    expectedAttendees, setExpectedAttendees,
    specialRequests, setSpecialRequests,
    selfFacilitationConfirmed, setSelfFacilitationConfirmed,
    facilitatorName, setFacilitatorName,
    staffSearch, setStaffSearch,
    loadingStaff, staffOpen, setStaffOpen, staffRef,
    bookingDeptCode, setBookingDeptCode,
    bookingCourseCode, setBookingCourseCode,
    sessionType, setSessionType,
    paidPurpose, setPaidPurpose,
    paidEventName, setPaidEventName,
    paidDescription, setPaidDescription,
    paidDate, setPaidDate,
    paidStartTime, setPaidStartTime,
    paidEndTime, setPaidEndTime,
    paidAttendees, setPaidAttendees,
    paidOrgName, setPaidOrgName,
    paidContact, setPaidContact,
    paidSpecialReqs, setPaidSpecialReqs,
    addonSound, setAddonSound,
    addonLed, setAddonLed,
    submitting, setSubmitting,
    submitError, setSubmitError,
    successState, setSuccessState,
    selectedFacility, isRentable, showSchoolForm,
    filteredFacilities, selectedDeptCourses, selectedCourseDeliveryMode,
    facilityMismatchWarning, facilityMatchGood,
    liveCost, soundAddon, ledAddon, amRate, pmRate, amCutoffLabel,
    today, filteredStaff, activeErrors, activeDate,
    err, touch,
  } = form

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitAttempted(true)
    setSubmitError(null)
    if (Object.keys(activeErrors).length > 0) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = useType === 'paid'
        ? {
            facility_id:        facilityId,
            booking_date:       paidDate,
            start_time:         paidStartTime,
            end_time:           paidEndTime,
            booking_purpose:    paidPurpose,
            purpose:            paidDescription,
            event_name:         paidEventName   || undefined,
            expected_attendees: paidAttendees   ? parseInt(paidAttendees,   10) : undefined,
            special_requests:   paidSpecialReqs || undefined,
            organization_name:  paidOrgName     || undefined,
            contact_number:     paidContact     || undefined,
            addon_sound:        addonSound      || undefined,
            addon_led:          addonLed        || undefined,
          }
        : {
            facility_id:                 facilityId,
            booking_date:                bookingDate,
            start_time:                  startTime,
            end_time:                    endTime,
            booking_purpose:             bookingPurpose,
            purpose,
            self_facilitation_confirmed: selfFacilitationConfirmed,
            facilitator_name:            !selfFacilitationConfirmed && facilitatorName ? facilitatorName : undefined,
            event_name:                  eventName         || undefined,
            expected_attendees:          expectedAttendees ? parseInt(expectedAttendees, 10) : undefined,
            special_requests:            specialRequests   || undefined,
            booking_department_code:     bookingDeptCode   || undefined,
            booking_course_code:         bookingCourseCode || undefined,
            session_type:                sessionType       || undefined,
          }

      const res  = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error ?? 'Failed to create booking.'); return }

      // Pipeline can return hard_constraint_failed even on 2xx — surface it as an error
      if (data.status === 'hard_constraint_failed') {
        setSubmitError(data.message ?? `Booking declined: ${data.failed_code ?? 'policy constraint'}. Please adjust your details and try again.`)
        return
      }

      // Async path: the server runs the decision pipeline via after().
      // Poll for the final status before showing the success screen.
      if (data.status === 'processing' && data.booking_id) {
        const bookingId = data.booking_id
        const AUTO_TERMINAL = new Set(['auto_approved', 'approved', 'auto_declined', 'flagged', 'rejected'])

        const result = await new Promise<typeof data>((resolve) => {
          let attempts = 0
          const interval = setInterval(async () => {
            attempts++
            try {
              const res = await fetch(`/api/bookings/${bookingId}/status`)
              if (!res.ok) return
              const row = await res.json()
              if (row && (AUTO_TERMINAL.has(row.current_status) || (row.current_status === 'pending' && row.pipeline_processed_at))) {
                clearInterval(interval)
                resolve({ ...data, status: row.current_status })
              } else if (attempts >= 12) {
                clearInterval(interval)
                resolve({ ...data, status: 'still_processing' })
              }
            } catch {
              if (attempts >= 12) {
                clearInterval(interval)
                resolve({ ...data, status: 'still_processing' })
              }
            }
          }, 2500)
        })

        if (result.status === 'hard_constraint_failed' || result.status === 'auto_declined') {
          setSubmitError(result.message ?? 'Booking was declined. Please adjust your details and try again.')
          return
        }

        if (result.requires_payment) {
          setSuccessState({ type: 'payment_required', bookingReference: result.booking_reference, paymentId: result.payment_id ?? null })
        } else {
          setSuccessState({ type: 'auto_approved', bookingReference: result.booking_reference })
        }
        return
      }

      if (data.requires_payment) {
        setSuccessState({ type: 'payment_required', bookingReference: data.booking_reference, paymentId: data.payment_id ?? null })
      } else {
        setSuccessState({ type: 'auto_approved', bookingReference: data.booking_reference })
      }
    } catch {
      setSubmitError('An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (successState) {
    return (
      <ReserveSuccessScreen
        successState={successState}
        onNewReservation={() => { setSuccessState(null); setFacilityId(''); setFacilitySearch('') }}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <style>{`
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(16,185,129,.5) transparent; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 9999px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(16,185,129,.5); border-radius: 9999px; border: 2px solid transparent; background-clip: content-box; }
      `}</style>

      <div className="flex-1 overflow-auto custom-scrollbar py-8 px-6">
        <main className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Privileged <span className="text-accent-brand">Reservation</span></h1>
            <p className="text-muted-foreground mt-2 flex items-center justify-center gap-2 text-base">
              <Info className="w-4 h-4 text-sti-blue dark:text-accent-light" />
              Building Head school-use reservations are automatically approved.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* ── Left: Form ───────────────────────────────────────────── */}
              <div className="lg:col-span-2 space-y-5">

                <ReserveFormReservationDetails
                  lockedFacilityName={lockedFacilityName}
                  isFacilityLocked={isFacilityLocked}
                  loadingFacilities={loadingFacilities}
                  facilitySearch={facilitySearch}
                  setFacilitySearch={setFacilitySearch}
                  facilityOpen={facilityOpen}
                  setFacilityOpen={setFacilityOpen}
                  facilityRef={facilityRef}
                  facilityId={facilityId}
                  setFacilityId={setFacilityId}
                  filteredFacilities={filteredFacilities}
                  useType={useType}
                  setUseType={setUseType}
                  selectedFacility={selectedFacility}
                  isRentable={isRentable}
                  showSchoolForm={showSchoolForm}
                  today={today}
                  bookingDate={bookingDate}
                  setBookingDate={setBookingDate}
                  expectedAttendees={expectedAttendees}
                  setExpectedAttendees={setExpectedAttendees}
                  availability={availability}
                  startTime={startTime}
                  setStartTime={setStartTime}
                  endTime={endTime}
                  setEndTime={setEndTime}
                  bookingPurpose={bookingPurpose}
                  setBookingPurpose={setBookingPurpose}
                  loadingCourses={loadingCourses}
                  departmentCourses={departmentCourses}
                  bookingDeptCode={bookingDeptCode}
                  setBookingDeptCode={setBookingDeptCode}
                  bookingCourseCode={bookingCourseCode}
                  setBookingCourseCode={setBookingCourseCode}
                  selectedDeptCourses={selectedDeptCourses}
                  sessionType={sessionType}
                  setSessionType={setSessionType}
                  selectedCourseDeliveryMode={selectedCourseDeliveryMode}
                  facilityMismatchWarning={facilityMismatchWarning}
                  facilityMatchGood={facilityMatchGood}
                  err={err}
                  touch={touch}
                />

                {/* Section: Event Details (school) */}
                {showSchoolForm && (
                  <ReserveFormEventDetails
                    eventName={eventName}
                    setEventName={setEventName}
                    purpose={purpose}
                    setPurpose={setPurpose}
                    specialRequests={specialRequests}
                    setSpecialRequests={setSpecialRequests}
                    selfFacilitationConfirmed={selfFacilitationConfirmed}
                    setSelfFacilitationConfirmed={setSelfFacilitationConfirmed}
                    facilitatorName={facilitatorName}
                    setFacilitatorName={setFacilitatorName}
                    staffSearch={staffSearch}
                    setStaffSearch={setStaffSearch}
                    staffOpen={staffOpen}
                    setStaffOpen={setStaffOpen}
                    staffRef={staffRef}
                    loadingStaff={loadingStaff}
                    filteredStaff={filteredStaff}
                    submitAttempted={submitAttempted}
                    touched={touched}
                    err={err}
                    touch={touch}
                  />
                )}

                {/* ── Paid form ──────────────────────────────────────────── */}
                {facilityId && useType === 'paid' && (
                  <ReserveFormPaidDetails
                    today={today}
                    paidPurpose={paidPurpose}
                    setPaidPurpose={setPaidPurpose}
                    paidEventName={paidEventName}
                    setPaidEventName={setPaidEventName}
                    paidDescription={paidDescription}
                    setPaidDescription={setPaidDescription}
                    paidDate={paidDate}
                    setPaidDate={setPaidDate}
                    paidAttendees={paidAttendees}
                    setPaidAttendees={setPaidAttendees}
                    paidStartTime={paidStartTime}
                    setPaidStartTime={setPaidStartTime}
                    paidEndTime={paidEndTime}
                    setPaidEndTime={setPaidEndTime}
                    paidOrgName={paidOrgName}
                    setPaidOrgName={setPaidOrgName}
                    paidContact={paidContact}
                    setPaidContact={setPaidContact}
                    paidSpecialReqs={paidSpecialReqs}
                    setPaidSpecialReqs={setPaidSpecialReqs}
                    touched={touched}
                    err={err}
                    touch={touch}
                  />
                )}

                {submitError && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
                    {submitError}
                  </div>
                )}

                {/* Submit button — always visible once a facility is selected or for school flow */}
                {(showSchoolForm || useType === 'paid') && (
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 text-base font-semibold"
                  >
                    {submitting
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                      : useType === 'paid' ? 'Submit & Pay Later' : 'Submit Booking'
                    }
                  </Button>
                )}
              </div>

              {/* ── Right: Availability + Summary/Fees ──────────────────── */}
              <ReserveSidePanel
                facilityId={facilityId}
                activeDate={activeDate}
                loadingAvailability={loadingAvailability}
                availability={availability}
                showSchoolForm={showSchoolForm}
                selectedFacility={selectedFacility}
                bookingDate={bookingDate}
                startTime={startTime}
                endTime={endTime}
                purposeLabel={SCHOOL_PURPOSE_OPTIONS.find(p => p.value === bookingPurpose)?.label}
                selfFacilitationConfirmed={selfFacilitationConfirmed}
                facilitatorName={facilitatorName}
                useType={useType}
                soundAddon={soundAddon}
                ledAddon={ledAddon}
                addonSound={addonSound}
                setAddonSound={setAddonSound}
                addonLed={addonLed}
                setAddonLed={setAddonLed}
                liveCost={liveCost}
                amRate={amRate}
                pmRate={pmRate}
                amCutoffLabel={amCutoffLabel}
              />
            </div>
          </form>
        </main>
      </div>
    </div>
  )
}

export default function BuildingAdminReservePage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sti-blue border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BuildingAdminReservePageInner />
    </Suspense>
  )
}
