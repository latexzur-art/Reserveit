"use client"

import { useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ConnectedClientTopBar } from '../_components/ConnectedClientTopBar'
import { FacilityPicker } from './_components/FacilityPicker'
import { FeesPanel } from './_components/FeesPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FacilityCatalog } from '@/components/shared/facilities/FacilityCatalog'
import { useRentalBookingForm } from '@/app/client/_hooks/useGymBookingForm'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, Building2, CheckCircle, AlertCircle, Clock, CalendarIcon, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { TimeSlotPicker } from '@/components/ui/TimeSlotPicker'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ROUTES } from '@/lib/routes'
import { formatTime } from '@/lib/formatTime'
import { FacilityWarningBannerInline } from '@/components/shared/facilities/FacilityWarningBannerInline'
import { SkeletonList } from "@/components/ui/SkeletonList"

const PURPOSE_OPTIONS = [
  { value: 'personal', label: 'Personal / Sports / Recreation' },
  { value: 'community', label: 'Community Event' },
  { value: 'commercial', label: 'Commercial / Business' },
]

function ClientBookingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFacilityId = searchParams.get('facility_id') ?? undefined
  const { toast } = useToast()

  const {
    rentableFacilities,
    selectedFacility,
    selectedFacilityId,
    selectFacility,
    loadingFacilities,
    facilityError,
    facilityRates,
    loadingRates,
    formData,
    updateField,
    liveCost,
    validationErrors,
    submitting,
    submitResult,
    submitError,
    submit,
    reset,
    existingBookings,
    availability,
    loadingAvailability,
    bookedDates,
    displayedMonth,
    setDisplayedMonth,
  } = useRentalBookingForm(initialFacilityId)

  const disabledDates = useMemo(() => bookedDates.map(d => new Date(d)), [bookedDates])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    if (!submitResult) return
    toast({
      title: 'Booking Submitted',
      description: `Reference: ${submitResult.booking_reference}. Awaiting admin approval.`,
    })
  }, [submitResult, toast])

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadingFacilities) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-300">
        <ConnectedClientTopBar title="New Booking" breadcrumbs={[{ label: 'Dashboard', href: ROUTES.client.dashboard }]} />
        <main className="p-4 sm:p-8 max-w-4xl mx-auto pb-24">
          <SkeletonList />
        </main>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (facilityError) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-300">
        <ConnectedClientTopBar title="New Booking" breadcrumbs={[{ label: 'Dashboard', href: ROUTES.client.dashboard }]} />
        <main className="p-4 sm:p-8 max-w-4xl mx-auto pb-24">
          <div className="flex items-center justify-center h-64 border border-border/80 rounded-2xl bg-card">
            <div className="text-center p-6">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">{facilityError}</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (submitResult) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-300">
        <ConnectedClientTopBar title="New Booking" breadcrumbs={[{ label: 'Dashboard', href: ROUTES.client.dashboard }]} />
        <main className="max-w-2xl mx-auto p-4 sm:p-8 pb-24 text-center">
          <div className="bg-card border border-border/80 rounded-2xl shadow-xs p-8 sm:p-10">
            <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Booking Submitted!</h2>
            <p className="text-xs text-muted-foreground mb-2">Reference: <strong className="text-foreground">{submitResult.booking_reference}</strong></p>
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 text-left">
              <Clock className="inline w-4 h-4 mr-1.5 shrink-0" />
              Your request is <strong>pending admin approval</strong>. Once approved, an invoice will be generated and you'll be notified to complete payment.
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
              <Button onClick={reset} className="rounded-xl text-xs font-semibold">Submit Another</Button>
              <Button variant="outline" onClick={() => router.push(ROUTES.client.bookings)} className="rounded-xl text-xs font-semibold">View My Bookings</Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Facility selection screen ─────────────────────────────────────────────
  if (!selectedFacility) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-300">
        <ConnectedClientTopBar title="New Booking" breadcrumbs={[{ label: 'Dashboard', href: ROUTES.client.dashboard }]} />
        <main className="p-4 sm:p-8 max-w-4xl mx-auto pb-24">
          <Tabs defaultValue="quick" className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="p-1 bg-muted/40 border border-border/60 rounded-xl h-auto">
                <TabsTrigger value="quick" className="px-4 py-1.5 rounded-lg text-xs font-medium">Quick Pick</TabsTrigger>
                <TabsTrigger value="browse" className="px-4 py-1.5 rounded-lg text-xs font-medium">Browse Facilities</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="quick">
              <FacilityPicker rentableFacilities={rentableFacilities} onSelect={selectFacility} />
            </TabsContent>
            <TabsContent value="browse">
              <FacilityCatalog rentalOnly onReserveSelect={facility => selectFacility(facility.id)} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    )
  }

  // ── Booking form (facility selected) ────────────────────────────────────

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <ConnectedClientTopBar title="New Booking" breadcrumbs={[{ label: 'Dashboard', href: ROUTES.client.dashboard }]} />

      <main className="p-4 sm:p-8 max-w-4xl mx-auto pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => selectFacility('')} className="gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" /> Back to Facilities
          </Button>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-1 text-center">{selectedFacility.name} Rental Form</h1>
        <p className="text-center text-xs text-muted-foreground mb-8">STI College Lucena — Perez St. corner Quezon Ave., Brgy. IX</p>

        {/* Facility badge */}
        <div className="flex items-center gap-3 mb-6 p-4 bg-card rounded-2xl border border-border/80 shadow-xs">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">{selectedFacility.name}</p>
            {selectedFacility.capacity && <p className="text-xs text-muted-foreground">Capacity: {selectedFacility.capacity} persons</p>}
          </div>
          <span className="ml-auto text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">Available</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-6">

            {/* Renter Information */}
            <section className="bg-card rounded-2xl border border-border/80 shadow-xs p-6">
              <h2 className="text-base font-semibold text-foreground border-b border-border/50 pb-2.5 mb-4">Renter Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Organization / Company <span className="text-muted-foreground/60">(optional)</span></label>
                  <Input
                    value={formData.organization_name}
                    onChange={e => updateField('organization_name', e.target.value)}
                    placeholder="e.g. Masagana Barangay"
                    className="text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Contact Number</label>
                  <Input
                    value={formData.contact_number}
                    onChange={e => updateField('contact_number', e.target.value)}
                    placeholder="e.g. 09XX-XXX-XXXX"
                    type="tel"
                    className={cn("text-xs rounded-xl", validationErrors.contact_number && 'border-destructive')}
                  />
                  {validationErrors.contact_number && <p className="text-xs text-destructive mt-1">{validationErrors.contact_number}</p>}
                </div>
              </div>
            </section>

            {/* Facility Warnings */}
            {selectedFacilityId && (
              <FacilityWarningBannerInline facilityId={selectedFacilityId} />
            )}

            {/* Rental Details */}
            <section className="bg-card rounded-2xl border border-border/80 shadow-xs p-6">
              <h2 className="text-base font-semibold text-foreground border-b border-border/50 pb-2.5 mb-4">Rental Details</h2>
              <div className="space-y-4">
                {/* Purpose */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Purpose of Rental / Event <span className="text-destructive">*</span></label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {PURPOSE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={formData.booking_purpose === opt.value}
                        onClick={() => updateField('booking_purpose', opt.value as GymBookingFormData['booking_purpose'])}
                        className={cn(
                          'px-3 py-2 rounded-xl text-xs text-left transition-all border font-medium',
                          formData.booking_purpose === opt.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/80 hover:border-primary/50 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Event name */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Event / Activity Name <span className="text-destructive">*</span></label>
                  <Input
                    value={formData.event_name}
                    onChange={e => updateField('event_name', e.target.value)}
                    placeholder="e.g. Basketball Tournament"
                    className={cn("text-xs rounded-xl", validationErrors.event_name && 'border-destructive')}
                  />
                  {validationErrors.event_name && <p className="text-xs text-destructive mt-1">{validationErrors.event_name}</p>}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description / Purpose <span className="text-destructive">*</span></label>
                  <textarea
                    rows={2}
                    value={formData.purpose}
                    onChange={e => updateField('purpose', e.target.value)}
                    placeholder="Brief description of the event or activity..."
                    className={cn(
                      'w-full rounded-xl border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none',
                      validationErrors.purpose && 'border-destructive'
                    )}
                  />
                  <div className="flex items-start justify-between gap-2 mt-1">
                    {validationErrors.purpose ? (
                      <p className="text-xs text-destructive">{validationErrors.purpose}</p>
                    ) : <span />}
                    <span className={cn('text-xs shrink-0 ml-auto font-medium', formData.purpose.trim().length >= 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                      {formData.purpose.trim().length}/10 min
                    </span>
                  </div>
                </div>

                {/* Date + Attendees */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date Requested <span className="text-destructive">*</span></label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal border-input h-9 text-xs rounded-xl",
                            !formData.booking_date && "text-muted-foreground",
                            validationErrors.booking_date && "border-destructive hover:bg-destructive/10"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.booking_date ? format(new Date(formData.booking_date), "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.booking_date ? new Date(formData.booking_date) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const year = date.getFullYear()
                              const month = String(date.getMonth() + 1).padStart(2, '0')
                              const day = String(date.getDate()).padStart(2, '0')
                              updateField('booking_date', `${year}-${month}-${day}`)
                            } else {
                              updateField('booking_date', '')
                            }
                          }}
                          disabled={(date) => {
                            if (date < today) return true
                            const dateStr = format(date, "yyyy-MM-dd")
                            return bookedDates.includes(dateStr)
                          }}
                          onMonthChange={(month) => {
                            const y = month.getFullYear()
                            const m = String(month.getMonth() + 1).padStart(2, '0')
                            setDisplayedMonth(`${y}-${m}`)
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {validationErrors.booking_date && <p className="text-xs text-destructive mt-1">{validationErrors.booking_date}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Expected Attendees</label>
                    <Input
                      type="number"
                      min="1"
                      max="200"
                      value={formData.expected_attendees}
                      onChange={e => updateField('expected_attendees', e.target.value)}
                      placeholder="e.g. 50"
                      className={cn("text-xs rounded-xl", validationErrors.expected_attendees && 'border-destructive')}
                    />
                    {validationErrors.expected_attendees && <p className="text-xs text-destructive mt-1">{validationErrors.expected_attendees}</p>}
                  </div>
                </div>

                {/* Time Pickers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

                {/* Recurring */}
                <div className="flex items-center gap-3 pt-2">
                  <span className="text-xs font-medium text-muted-foreground">Is this a recurring event?</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.is_recurring}
                    aria-label="Recurring event"
                    onClick={() => updateField('is_recurring', !formData.is_recurring)}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      formData.is_recurring ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', formData.is_recurring ? 'translate-x-4' : 'translate-x-0.5')} />
                  </button>
                  <span className="text-xs font-medium text-foreground">{formData.is_recurring ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </section>

            {/* Equipment & Personnel */}
            <section className="bg-card rounded-2xl border border-border/80 shadow-xs p-6">
              <h2 className="text-base font-semibold text-foreground border-b border-border/50 pb-2.5 mb-4">Equipment & Additional Personnel</h2>
              <textarea
                rows={2}
                value={formData.special_requests}
                onChange={e => updateField('special_requests', e.target.value)}
                placeholder="List any equipment or materials you will bring into the facility..."
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Note: Maintenance personnel rate is managed separately by the requesting party.
              </p>
            </section>

            {submitError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}

            <Button
              onClick={submit}
              disabled={submitting || !selectedFacility}
              className="w-full h-11 text-xs font-semibold rounded-xl"
            >
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Submit Reservation Request'}
            </Button>
          </div>

          {/* Right sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Availability panel */}
            <div className="bg-card rounded-2xl border border-border/80 shadow-xs p-4 min-h-[140px]">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Availability</h4>
              {!formData.booking_date ? (
                <div className="flex flex-col items-center justify-center h-20 text-muted-foreground text-center">
                  <Clock className="w-6 h-6 mb-1.5 opacity-40" />
                  <p className="text-xs">Select a date to see availability</p>
                </div>
              ) : loadingAvailability ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />)}
                </div>
              ) : availability ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {formatTime(availability.operating_hours.open)} – {formatTime(availability.operating_hours.close)}
                  </p>
                  {availability.blocked_ranges.length > 0 ? (
                    <>
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Blocked times:</p>
                      {availability.blocked_ranges.map((block, i) => (
                        <div key={i} className="px-3 py-1.5 rounded-lg bg-destructive/5 border border-destructive/15 text-xs">
                          <span className="font-medium">{formatTime(block.start)} – {formatTime(block.end)}</span>
                          <span className="text-destructive/70 ml-1.5">{block.reason}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">All times available</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">Could not load availability</p>
              )}
            </div>

            {/* Fees panel */}
            <FeesPanel
              facilityRates={facilityRates}
              loadingRates={loadingRates}
              formData={formData}
              updateField={updateField}
              liveCost={liveCost}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ClientBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <ConnectedClientTopBar title="New Booking" breadcrumbs={[{ label: 'Dashboard', href: ROUTES.client.dashboard }]} />
        <main className="p-4 sm:p-8 max-w-4xl mx-auto pb-24">
          <SkeletonList />
        </main>
      </div>
    }>
      <ClientBookingPageInner />
    </Suspense>
  )
}

type GymBookingFormData = import('@/app/client/_hooks/useGymBookingForm').GymBookingFormData
