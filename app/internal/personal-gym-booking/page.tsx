"use client"

import { useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useInternalGymBookingForm } from '@/hooks/internal/useInternalGymBookingForm'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, Building2, CheckCircle, AlertCircle, Clock, ArrowLeft, CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TimeSlotPicker } from '@/components/ui/TimeSlotPicker'
import { SkeletonList } from "@/components/ui/SkeletonList";
import { formatEnumLabel } from "@/lib/enum-labels";


const PURPOSE_OPTIONS = [
  { value: 'personal',   label: 'Personal / Sports / Recreation' },
  { value: 'community',  label: 'Community Event' },
  { value: 'commercial', label: 'Commercial / Business' },
]

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

function InternalPersonalGymBookingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const facilityId = searchParams.get('facility_id') ?? undefined
  const returnUrl = searchParams.get('returnUrl') ?? '/faculty/reservations'
  const prefillParam = searchParams.get('prefill')

  const {
    rentableFacilities,
    gymnasium,
    loadingFacility,
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
  } = useInternalGymBookingForm(facilityId)

  const disabledDates = existingBookings
    .filter(b => b.start <= '08:00' && b.end >= '20:00')
    .map(b => new Date(b.date))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Apply AI chatbot prefill once the form is ready
  const prefillApplied = useRef(false)
  useEffect(() => {
    if (!prefillParam || prefillApplied.current) return
    prefillApplied.current = true
    try {
      const p = JSON.parse(decodeURIComponent(prefillParam))
      if (p.booking_date)       updateField('booking_date',       p.booking_date)
      if (p.start_time)         updateField('start_time',         p.start_time)
      if (p.end_time)           updateField('end_time',           p.end_time)
      if (p.booking_purpose)    updateField('booking_purpose',    p.booking_purpose)
      if (p.expected_attendees) updateField('expected_attendees', String(p.expected_attendees))
      if (p.event_name)         updateField('event_name',         p.event_name)
      if (p.purpose)            updateField('purpose',            p.purpose)
      if (p.special_requests)   updateField('special_requests',   p.special_requests)
      if (p.special_requests) {
        const sr = (p.special_requests as string).toLowerCase()
        if (sr.includes('sound')) updateField('addon_sound', true)
        if (sr.includes('light')) updateField('addon_led',   true)
      }
    } catch {
      // malformed prefill — ignore
    }
  }, [prefillParam, updateField])

  useEffect(() => {
    if (!submitResult) return
    toast({
      title: 'Booking Submitted',
      description: `Reference: ${submitResult.booking_reference}. Awaiting building head approval.`,
    })
  }, [submitResult, toast])

  const headerBar = (
    <div className="bg-white dark:bg-slate-800 border-b border-border px-6 py-4 flex items-center gap-3 shadow-sm">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <div className="h-5 w-px bg-border" />
      <h1 className="text-base font-semibold text-slate-900 dark:text-white">
        {gymnasium ? `${gymnasium.name} — Personal Booking` : 'Personal Facility Booking'}
      </h1>
    </div>
  )

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadingFacility) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        {headerBar}
        <SkeletonList />
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (facilityError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        {headerBar}
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400 mx-auto mb-3" />
            <p className="text-muted-foreground">{facilityError}</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (submitResult) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        {headerBar}
        <main className="max-w-2xl mx-auto px-6 py-12 text-center">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-10">
            <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Booking Submitted!</h2>
            <p className="text-muted-foreground mb-2">Reference: <strong>{submitResult.booking_reference}</strong></p>
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
              <Clock className="inline w-4 h-4 mr-1" />
              Your request is <strong>pending building head approval</strong>. Once approved, an invoice will be generated and you'll be notified to complete payment.
            </div>
            <div className="flex gap-3 mt-8 justify-center">
              <Button onClick={reset}>Submit Another</Button>
              <Button variant="outline" onClick={() => router.push(returnUrl)}>View My Bookings</Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Facility selection (no facilityId in URL) ─────────────────────────────
  if (!gymnasium) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        {headerBar}
        <div className="overflow-auto py-8 px-6">
          <main className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 text-center">Personal Facility Booking</h1>
            <p className="text-center text-muted-foreground mb-8 text-sm">Select a facility to book for personal or non-academic use</p>

            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              <span>These bookings require <strong>building head approval</strong> and payment after approval. They do not go through the standard academic pipeline.</span>
            </div>

            {rentableFacilities.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No facilities are currently available for rental.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rentableFacilities.map(facility => (
                  <button
                    key={facility.id}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString())
                      params.set('facility_id', facility.id)
                      router.push(`/internal/personal-gym-booking?${params.toString()}`)
                    }}
                    className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-border shadow-sm p-5 hover:border-primary hover:shadow-md transition-[border-color,box-shadow] group"
                  >
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg w-fit mb-3 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                      <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="font-bold text-foreground mb-1">{facility.name}</p>
                    {facility.room_number && <p className="text-xs text-muted-foreground mb-1">Room {facility.room_number}</p>}
                    {facility.capacity && <p className="text-xs text-muted-foreground">Up to {facility.capacity} persons</p>}
                    {facility.facility_types?.name && (
                      <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                        {formatEnumLabel(facility.facility_types.name)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    )
  }

  // ── Booking form ──────────────────────────────────────────────────────────
  const soundAddon = facilityRates?.addons.find(a => a.name.toLowerCase().includes('sound'))
  const ledAddon = facilityRates?.addons.find(a => a.name.toLowerCase().includes('led'))
  const otherAddons = facilityRates?.addons.filter(a =>
    !a.name.toLowerCase().includes('sound') && !a.name.toLowerCase().includes('led')
  ) ?? []

  const amRate = facilityRates?.amRate ?? 580
  const pmRate = facilityRates?.pmRate ?? 780
  const amCutoff = facilityRates?.amCutoffHour ?? 17
  const amCutoffLabel = `${amCutoff > 12 ? amCutoff - 12 : amCutoff}:00 ${amCutoff >= 12 ? 'PM' : 'AM'}`

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {headerBar}

      <div className="overflow-auto py-8 px-6">
        <main className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 text-center">{gymnasium.name} — Personal Booking</h1>
          <p className="text-center text-muted-foreground mb-3 text-sm">For personal, community, or commercial use — requires building head approval and payment</p>

          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 shrink-0" />
            <span>This booking does <strong>not</strong> go through the standard approval pipeline. The Building Head will review your request manually. Payment is required after approval.</span>
          </div>

          {/* Facility badge */}
          <div className="flex items-center gap-3 mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-border shadow-sm">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{gymnasium.name}</p>
              {gymnasium.capacity && <p className="text-xs text-muted-foreground">Capacity: {gymnasium.capacity} persons</p>}
            </div>
            <span className="ml-auto text-xs bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-1 rounded-full font-medium">Available</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Form */}
            <div className="lg:col-span-2 space-y-6">

              {/* Renter Information */}
              <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
                <h2 className="text-base font-bold mb-4 text-slate-900 dark:text-white uppercase tracking-wide border-b border-border pb-2">Renter Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="organization_name" className="block text-sm font-medium text-muted-foreground mb-1">Organization / Company <span className="text-xs text-muted-foreground">(optional)</span></label>
                    <Input
                      id="organization_name"
                      value={formData.organization_name}
                      onChange={e => updateField('organization_name', e.target.value)}
                      placeholder="e.g. Faculty Sports Club"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact_number" className="block text-sm font-medium text-muted-foreground mb-1">Contact Number <span className="text-xs text-muted-foreground">(optional)</span></label>
                    <Input
                      id="contact_number"
                      value={formData.contact_number}
                      onChange={e => updateField('contact_number', e.target.value)}
                      placeholder="e.g. 09XX-XXX-XXXX"
                      type="tel"
                      className={cn(validationErrors.contact_number && 'border-destructive')}
                    />
                    {validationErrors.contact_number && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.contact_number}</p>}
                  </div>
                </div>
              </section>

              {/* Rental Details */}
              <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
                <h2 className="text-base font-bold mb-4 text-slate-900 dark:text-white uppercase tracking-wide border-b border-border pb-2">Rental Details</h2>
                <div className="space-y-4">
                  {/* Purpose */}
                  <div>
                    <label id="booking_purpose_label" className="block text-sm font-medium text-muted-foreground mb-1">Purpose of Use <span className="text-red-600 dark:text-red-400">*</span></label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-labelledby="booking_purpose_label">
                      {PURPOSE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={formData.booking_purpose === opt.value}
                          onClick={() => updateField('booking_purpose', opt.value as 'personal' | 'community' | 'commercial')}
                          className={cn(
                            'px-3 py-2 rounded-lg text-sm border text-left transition-colors',
                            formData.booking_purpose === opt.value
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-border hover:border-primary/50'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Event name */}
                  <div>
                    <label htmlFor="event_name" className="block text-sm font-medium text-muted-foreground mb-1">Event / Activity Name <span className="text-red-600 dark:text-red-400">*</span></label>
                    <Input
                      id="event_name"
                      value={formData.event_name}
                      onChange={e => updateField('event_name', e.target.value)}
                      placeholder="e.g. Badminton Practice"
                      className={cn(validationErrors.event_name && 'border-destructive')}
                    />
                    {validationErrors.event_name && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.event_name}</p>}
                  </div>

                  {/* Purpose / Description */}
                  <div>
                    <label htmlFor="purpose" className="block text-sm font-medium text-muted-foreground mb-1">Description / Purpose <span className="text-red-600 dark:text-red-400">*</span></label>
                    <textarea
                      id="purpose"
                      rows={2}
                      value={formData.purpose}
                      onChange={e => updateField('purpose', e.target.value)}
                      placeholder="Brief description of the activity..."
                      className={cn(
                        'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none',
                        validationErrors.purpose && 'border-destructive'
                      )}
                    />
                    <div className="flex items-start justify-between gap-2 mt-1">
                      {validationErrors.purpose ? (
                        <p className="text-xs text-red-600 dark:text-red-400">{validationErrors.purpose}</p>
                      ) : <span />}
                      <span className={cn('text-xs shrink-0 ml-auto', formData.purpose.trim().length >= 10 ? 'text-emerald-600' : 'text-muted-foreground')}>
                        {formData.purpose.trim().length}/10 min
                      </span>
                    </div>
                  </div>

                  {/* Date + Attendees */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="booking_date" className="block text-sm font-medium text-muted-foreground mb-1">Date Requested <span className="text-red-600 dark:text-red-400">*</span></label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="booking_date"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal border-input",
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
                              return disabledDates.some(d => d.getTime() === date.getTime())
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {validationErrors.booking_date && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.booking_date}</p>}
                    </div>
                    <div>
                      <label htmlFor="expected_attendees" className="block text-sm font-medium text-muted-foreground mb-1">Expected Attendees</label>
                      <Input
                        id="expected_attendees"
                        type="number"
                        min="1"
                        max="200"
                        value={formData.expected_attendees}
                        onChange={e => updateField('expected_attendees', e.target.value)}
                        placeholder="e.g. 10"
                        className={cn(validationErrors.expected_attendees && 'border-destructive')}
                      />
                      {validationErrors.expected_attendees && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.expected_attendees}</p>}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label id="start_time_label" className="block text-sm font-medium text-muted-foreground mb-1">Start Time <span className="text-red-600 dark:text-red-400">*</span></label>
                      <div role="group" aria-labelledby="start_time_label">
                        <TimeSlotPicker
                          hideLabel
                          value={formData.start_time}
                          onChange={(t) => updateField('start_time', t)}
                          blockedRanges={existingBookings
                            .filter(b => b.date === formData.booking_date)
                            .map(b => ({ start: b.start, end: b.end, reason: b.reason }))}
                          error={validationErrors.start_time}
                        />
                      </div>
                    </div>
                    <div>
                      <label id="end_time_label" className="block text-sm font-medium text-muted-foreground mb-1">End Time <span className="text-red-600 dark:text-red-400">*</span></label>
                      <div role="group" aria-labelledby="end_time_label">
                        <TimeSlotPicker
                          hideLabel
                          value={formData.end_time}
                          onChange={(t) => updateField('end_time', t)}
                          blockedRanges={existingBookings
                            .filter(b => b.date === formData.booking_date)
                            .map(b => ({ start: b.start, end: b.end, reason: b.reason }))}
                          error={validationErrors.end_time}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Recurring */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Is this a recurring event?</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.is_recurring}
                      onClick={() => updateField('is_recurring', !formData.is_recurring)}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        'before:content-[\'\'] before:absolute before:-inset-3',
                        formData.is_recurring ? 'bg-primary' : 'bg-muted-foreground/30'
                      )}
                    >
                      <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', formData.is_recurring ? 'translate-x-4' : 'translate-x-0.5')} />
                    </button>
                    <span className="text-sm text-muted-foreground">{formData.is_recurring ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </section>

              {/* Equipment */}
              <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6">
                <h2 className="text-base font-bold mb-4 text-slate-900 dark:text-white uppercase tracking-wide border-b border-border pb-2">Equipment & Additional Notes</h2>
                <textarea
                  rows={2}
                  value={formData.special_requests}
                  onChange={e => updateField('special_requests', e.target.value)}
                  placeholder="List any equipment or materials you will bring, or any special requests..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </section>

              {submitError && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {submitError}
                </div>
              )}

              <Button
                onClick={submit}
                disabled={submitting || !gymnasium}
                className="w-full h-11 text-base font-semibold"
              >
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Submit Booking Request'}
              </Button>
            </div>

            {/* Right: Fees panel */}
            <div className="lg:col-span-1">
              <div className="sticky top-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-3">
                  <h3 className="font-bold text-sm uppercase tracking-wide">Fees and Charges</h3>
                </div>

                {/* Add-ons — dynamic from DB */}
                {(facilityRates?.addons.length ?? 0) > 0 && (
                  <div className="px-5 py-4 space-y-3 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground">Add-ons</p>
                    {soundAddon && (
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">{soundAddon.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatCurrency(soundAddon.amount)}</span>
                          <span className="relative inline-flex before:content-[''] before:absolute before:-inset-3">
                            <input
                              type="checkbox"
                              checked={formData.addon_sound}
                              onChange={e => updateField('addon_sound', e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </span>
                        </div>
                      </label>
                    )}
                    {ledAddon && (
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">{ledAddon.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatCurrency(ledAddon.amount)}</span>
                          <span className="relative inline-flex before:content-[''] before:absolute before:-inset-3">
                            <input
                              type="checkbox"
                              checked={formData.addon_led}
                              onChange={e => updateField('addon_led', e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </span>
                        </div>
                      </label>
                    )}
                    {otherAddons.map(addon => (
                      <label key={addon.id} className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">{addon.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatCurrency(addon.amount)}</span>
                          <span className="relative inline-flex before:content-[''] before:absolute before:-inset-3">
                            <input
                              type="checkbox"
                              checked={formData.addon_other_ids.includes(addon.id)}
                              onChange={e => {
                                const ids = formData.addon_other_ids
                                updateField('addon_other_ids', e.target.checked
                                  ? [...ids, addon.id]
                                  : ids.filter(id => id !== addon.id)
                                )
                              }}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* Fallback add-ons only when rates are confirmed absent (not while loading) */}
                {!loadingRates && !facilityRates && (
                  <div className="px-5 py-4 space-y-3 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground">Energy Fee</p>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm">Basic Sound System</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">₱1,500</span>
                        <span className="relative inline-flex before:content-[''] before:absolute before:-inset-3">
                          <input type="checkbox" checked={formData.addon_sound} onChange={e => updateField('addon_sound', e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                        </span>
                      </div>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm">LED Lights</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">₱2,500</span>
                        <span className="relative inline-flex before:content-[''] before:absolute before:-inset-3">
                          <input type="checkbox" checked={formData.addon_led} onChange={e => updateField('addon_led', e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                {/* Breakdown table */}
                <div className="px-5 py-4">
                  {!liveCost.hasTime ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Select start and end time to see the fee breakdown</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-1.5 text-xs font-semibold text-muted-foreground">Item</th>
                          <th className="text-center py-1.5 text-xs font-semibold text-muted-foreground">Hrs</th>
                          <th className="text-right py-1.5 text-xs font-semibold text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveCost.breakdown.map((item, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-2 text-xs">
                              <div>{item.label}</div>
                              <div className="text-muted-foreground">{item.isFlatFee ? 'flat fee' : `₱${item.rate.toLocaleString()}/hr`}</div>
                            </td>
                            <td className="py-2 text-xs text-center text-muted-foreground">{item.isFlatFee ? '—' : item.hours.toFixed(1)}</td>
                            <td className="py-2 text-xs text-right font-medium">{formatCurrency(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-900 dark:border-slate-100">
                          <td colSpan={2} className="pt-3 font-bold text-sm uppercase">Total</td>
                          <td className="pt-3 font-bold text-sm text-right">{formatCurrency(liveCost.amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}

                  <div className="mt-4 text-xs text-muted-foreground space-y-1">
                    <p>• AM rate: ₱{amRate.toLocaleString()}/hr (before {amCutoffLabel})</p>
                    <p>• PM rate: ₱{pmRate.toLocaleString()}/hr ({amCutoffLabel} onwards)</p>
                  </div>
                </div>

                <div className="px-5 pb-5">
                  <p className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    Payment is required only after building head approval. You will be notified via your Notifications.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function InternalPersonalGymBookingPage() {
  return (
    <Suspense fallback={
      <SkeletonList />
    }>
      <InternalPersonalGymBookingPageInner />
    </Suspense>
  )
}
