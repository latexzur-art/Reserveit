'use client'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Info, Loader2 } from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import { SuccessState } from './self-booking/SuccessState'
import { useSelfBookingForm } from '@/hooks/admin/useSelfBookingForm'
import { FacilityPicker }      from './_self-booking/FacilityPicker'
import { SchoolFormSection }   from './_self-booking/SchoolFormSection'
import { EventDetailsSection } from './_self-booking/EventDetailsSection'
import { PaidFormSection }     from './_self-booking/PaidFormSection'
import { AvailabilitySidebar } from './_self-booking/AvailabilitySidebar'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function SelfBookingModal({ open, onClose, onSuccess }: Props) {
  const form = useSelfBookingForm(open, onSuccess)

  function handleClose() { form.resetForm(); onClose() }

  return (
    <Dialog open={open} onOpenChange={open ? handleClose : undefined}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">Privileged Reservation</DialogTitle>
        </DialogHeader>

        {/* Auto-approval notice */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-300">
          <Info className="w-4 h-4 shrink-0" />
          <span>Building Head school-use reservations are <strong>automatically approved</strong>.</span>
        </div>

        {/* ── Success ──────────────────────────────────────────────────────── */}
        {form.successState ? (
          <SuccessState
            successState={form.successState}
            onDone={handleClose}
            onGoToPayments={() => { handleClose(); onSuccess(); form.router.push(ROUTES.buildingAdmin.payment) }}
          />
        ) : (
          <form onSubmit={form.handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* ── Left: Form ─────────────────────────────────────────────── */}
              <div className="lg:col-span-2 space-y-4">

                {/* Section: Reservation Details */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    <span className="w-1 h-5 bg-emerald-500 rounded-full" />
                    Reservation Details
                  </h2>

                  <FacilityPicker
                    loadingFacilities={form.loadingFacilities}
                    facilityRef={form.facilityRef}
                    facilitySearch={form.facilitySearch}
                    setFacilitySearch={form.setFacilitySearch}
                    facilityOpen={form.facilityOpen}
                    setFacilityOpen={form.setFacilityOpen}
                    facilityId={form.facilityId}
                    setFacilityId={form.setFacilityId}
                    filteredFacilities={form.filteredFacilities}
                    err={form.err}
                  />

                  {/* Use-type prompt — rentable only */}
                  {form.facilityId && form.isRentable && !form.useType && (
                    <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                            Booking {form.selectedFacility?.name} for personal use?
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                            School-use bookings are auto-approved. Personal, community, and commercial use require payment.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => form.setUseType('school')}>
                          School Use (Free)
                        </Button>
                        <Button type="button" size="sm" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => form.setUseType('paid')}>
                          Personal Use (Paid)
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── School fields ──────────────────────────────────────── */}
                  {form.showSchoolForm && (
                    <SchoolFormSection
                      today={form.today}
                      bookingDate={form.bookingDate}
                      setBookingDate={form.setBookingDate}
                      expectedAttendees={form.expectedAttendees}
                      setExpectedAttendees={form.setExpectedAttendees}
                      startTime={form.startTime}
                      setStartTime={form.setStartTime}
                      endTime={form.endTime}
                      setEndTime={form.setEndTime}
                      availability={form.availability}
                      bookingPurpose={form.bookingPurpose}
                      setBookingPurpose={form.setBookingPurpose}
                      departmentCourses={form.departmentCourses}
                      loadingCourses={form.loadingCourses}
                      bookingDeptCode={form.bookingDeptCode}
                      setBookingDeptCode={form.setBookingDeptCode}
                      bookingCourseCode={form.bookingCourseCode}
                      setBookingCourseCode={form.setBookingCourseCode}
                      sessionType={form.sessionType}
                      setSessionType={form.setSessionType}
                      selectedDeptCourses={form.selectedDeptCourses}
                      selectedCourseDeliveryMode={form.selectedCourseDeliveryMode}
                      facilityMismatchWarning={form.facilityMismatchWarning}
                      facilityMatchGood={form.facilityMatchGood}
                      err={form.err}
                      touch={form.touch}
                    />
                  )}
                </section>

                {/* Section: Event Details (school) */}
                {form.showSchoolForm && (
                  <EventDetailsSection
                    eventName={form.eventName}
                    setEventName={form.setEventName}
                    purpose={form.purpose}
                    setPurpose={form.setPurpose}
                    specialRequests={form.specialRequests}
                    setSpecialRequests={form.setSpecialRequests}
                    selfFacilitationConfirmed={form.selfFacilitationConfirmed}
                    setSelfFacilitationConfirmed={form.setSelfFacilitationConfirmed}
                    touched={form.touched}
                    err={form.err}
                    touch={form.touch}
                  />
                )}

                {/* ── Paid form ─────────────────────────────────────────────── */}
                {form.facilityId && form.useType === 'paid' && (
                  <PaidFormSection
                    today={form.today}
                    paidPurpose={form.paidPurpose}
                    setPaidPurpose={form.setPaidPurpose}
                    paidEventName={form.paidEventName}
                    setPaidEventName={form.setPaidEventName}
                    paidDescription={form.paidDescription}
                    setPaidDescription={form.setPaidDescription}
                    paidDate={form.paidDate}
                    setPaidDate={form.setPaidDate}
                    paidStartTime={form.paidStartTime}
                    setPaidStartTime={form.setPaidStartTime}
                    paidEndTime={form.paidEndTime}
                    setPaidEndTime={form.setPaidEndTime}
                    paidAttendees={form.paidAttendees}
                    setPaidAttendees={form.setPaidAttendees}
                    paidOrgName={form.paidOrgName}
                    setPaidOrgName={form.setPaidOrgName}
                    paidContact={form.paidContact}
                    setPaidContact={form.setPaidContact}
                    paidSpecialReqs={form.paidSpecialReqs}
                    setPaidSpecialReqs={form.setPaidSpecialReqs}
                    availability={form.availability}
                    touched={form.touched}
                    err={form.err}
                    touch={form.touch}
                  />
                )}

                {form.submitError && (
                  <p className="text-sm text-red-500 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2">
                    {form.submitError}
                  </p>
                )}
              </div>

              {/* ── Right: Availability + Summary/Fees ─────────────────────── */}
              <AvailabilitySidebar
                facilityId={form.facilityId}
                activeDate={form.activeDate}
                loadingAvailability={form.loadingAvailability}
                availability={form.availability}
                showSchoolForm={form.showSchoolForm}
                useType={form.useType}
                selectedFacility={form.selectedFacility}
                bookingDate={form.bookingDate}
                startTime={form.startTime}
                endTime={form.endTime}
                bookingPurpose={form.bookingPurpose}
                soundAddon={form.soundAddon}
                ledAddon={form.ledAddon}
                addonSound={form.addonSound}
                setAddonSound={form.setAddonSound}
                addonLed={form.addonLed}
                setAddonLed={form.setAddonLed}
                liveCost={form.liveCost}
                amRate={form.amRate}
                pmRate={form.pmRate}
                amCutoffLabel={form.amCutoffLabel}
              />
            </div>

            {/* Footer */}
            {form.facilityId && (form.useType !== null || !form.isRentable) && (
              <DialogFooter className="pt-2 border-t border-border">
                <Button type="button" variant="outline" onClick={handleClose} disabled={form.submitting}>Cancel</Button>
                <Button type="submit" disabled={form.submitting}>
                  {form.submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {form.useType === 'paid' ? 'Submit & Pay Later' : 'Submit Booking'}
                </Button>
              </DialogFooter>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
