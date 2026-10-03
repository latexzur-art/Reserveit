'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { computeBookingAmount, type CostLineItem, type RateConfig } from '@/backend/booking/computeBookingAmount'
import type { FacilityRates } from '@/backend/admin/building'
import type { AvailabilityResponse } from '@/backend/booking/booking.types'

export interface RentalFacility {
  id: string
  name: string
  capacity: number | null
  room_number: string | null
  is_available_for_rental?: boolean
  facility_types?: { name: string }
  floors?: { floor_number: number; buildings?: { name: string } }
}

export interface GymBookingFormData {
  organization_name: string
  contact_number: string
  booking_purpose: 'personal' | 'community' | 'commercial'
  event_name: string
  purpose: string
  booking_date: string
  start_time: string
  end_time: string
  expected_attendees: string
  is_recurring: boolean
  special_requests: string
  addon_sound: boolean
  addon_led: boolean
}

export interface GymBookingResult {
  status: string
  booking_id: string
  booking_reference: string
  requires_payment: boolean
  message: string
}

// Kept for backward compat — callers that previously used GymFacility
export type GymFacility = RentalFacility

const DEFAULT_FORM: GymBookingFormData = {
  organization_name: '',
  contact_number: '',
  booking_purpose: 'personal',
  event_name: '',
  purpose: '',
  booking_date: '',
  start_time: '',
  end_time: '',
  expected_attendees: '',
  is_recurring: false,
  special_requests: '',
  addon_sound: false,
  addon_led: false,
}

export interface LiveCost {
  amount: number
  breakdown: CostLineItem[]
  hasTime: boolean
}

export type { AvailabilityResponse }
export function useRentalBookingForm(initialFacilityId?: string) {
  const { user } = useAuth()

  // Facility selection
  const [rentableFacilities, setRentableFacilities] = useState<RentalFacility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(initialFacilityId ?? '')
  const [loadingFacilities, setLoadingFacilities] = useState(true)
  const [facilityError, setFacilityError] = useState<string | null>(null)

  // Rates fetched from DB for the selected facility
  const [facilityRates, setFacilityRates] = useState<FacilityRates | null>(null)
  const [loadingRates, setLoadingRates] = useState<boolean>(true)

  // Availability/schedule
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [existingBookings, setExistingBookings] = useState<{ date: string; start: string; end: string }[]>([])

  // Booked dates for the calendar (fetched per month)
  const [bookedDatesCache, setBookedDatesCache] = useState<Record<string, string[]>>({})
  const [displayedMonth, setDisplayedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Form
  const [formData, setFormData] = useState<GymBookingFormData>(DEFAULT_FORM)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<GymBookingResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const selectedFacility = rentableFacilities.find(f => f.id === selectedFacilityId) ?? null

  // Fetch all rentable facilities on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/facilities?rental=true')
        if (!res.ok) throw new Error('Failed to load facilities')
        const data = await res.json()
        const all: RentalFacility[] = data.facilities ?? []
        const rentable = all.filter(f => f.is_available_for_rental)
        setRentableFacilities(rentable)
        if (initialFacilityId && rentable.some(f => f.id === initialFacilityId)) {
          setSelectedFacilityId(initialFacilityId)
        }
      } catch {
        setFacilityError('Unable to load facility information.')
      } finally {
        setLoadingFacilities(false)
      }
    }
    load()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch rates whenever selected facility changes
  useEffect(() => {
    if (!selectedFacilityId) {
      setFacilityRates(null)
      setLoadingRates(false)
      return
    }
    setLoadingRates(true)
    fetch(`/api/facilities/${selectedFacilityId}/rates`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setFacilityRates(d))
      .catch(() => setFacilityRates(null))
      .finally(() => setLoadingRates(false))
  }, [selectedFacilityId])

  // Fetch availability when facility + date change. The response's
  // blocked_ranges (school events, other bookings, admin blocks, etc. for
  // that date) doubles as our client-side overlap-protection source, so we
  // derive existingBookings from it instead of leaving it permanently empty.
  useEffect(() => {
    if (!selectedFacilityId || !formData.booking_date) {
      setAvailability(null)
      setExistingBookings([])
      return
    }
    const bookingDate = formData.booking_date
    setLoadingAvailability(true)
    fetch(`/api/facilities/${selectedFacilityId}/availability?date=${bookingDate}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: AvailabilityResponse | null) => {
        setAvailability(d)
        setExistingBookings(
          (d?.blocked_ranges ?? []).map(r => ({ date: bookingDate, start: r.start, end: r.end }))
        )
      })
      .catch(() => {
        setAvailability(null)
        setExistingBookings([])
      })
      .finally(() => setLoadingAvailability(false))
  }, [selectedFacilityId, formData.booking_date])

  // Fetch booked dates for the displayed month (calendar blocking)
  const fetchBookedDates = useCallback(async (facilityId: string, month: string) => {
    if (!facilityId || bookedDatesCache[month]) return
    try {
      const res = await fetch(`/api/facilities/${facilityId}/booked-dates?month=${month}`)
      if (!res.ok) return
      const data = await res.json()
      setBookedDatesCache(prev => ({ ...prev, [month]: data.bookedDates ?? [] }))
    } catch { /* silent */ }
  }, [bookedDatesCache])

  useEffect(() => {
    if (selectedFacilityId) fetchBookedDates(selectedFacilityId, displayedMonth)
  }, [selectedFacilityId, displayedMonth, fetchBookedDates])

  // Clear cache on successful submit so new booking shows
  useEffect(() => {
    if (submitResult && selectedFacilityId) {
      setBookedDatesCache({})
      fetchBookedDates(selectedFacilityId, displayedMonth)
    }
  }, [submitResult]) // eslint-disable-line react-hooks/exhaustive-deps

  const bookedDates = bookedDatesCache[displayedMonth] ?? []

  const updateField = useCallback(<K extends keyof GymBookingFormData>(
    field: K,
    value: GymBookingFormData[K],
    error?: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setValidationErrors(prev => {
      const next = { ...prev }
      if (error) next[field as string] = error
      else delete next[field as string]
      return next
    })
  }, [])

  const selectFacility = useCallback((id: string) => {
    setSelectedFacilityId(id)
    setFormData(DEFAULT_FORM)
    setValidationErrors({})
    setAvailability(null)
    setExistingBookings([])
    setBookedDatesCache({})
  }, [])

  // Build RateConfig from DB-fetched rates
  const rateConfig: RateConfig | undefined = facilityRates
    ? {
        amRatePerHour: facilityRates.amRate ?? undefined,
        pmRatePerHour: facilityRates.pmRate ?? facilityRates.amRate ?? undefined,
        pmCutoffHour: facilityRates.amCutoffHour,
        addonSoundFee: facilityRates.addons.find(a => a.name.toLowerCase().includes('sound'))?.amount,
        addonLedFee: facilityRates.addons.find(a => a.name.toLowerCase().includes('led'))?.amount,
      }
    : undefined

  // Live cost calculation
  const liveCost: LiveCost = useMemo(() => {
    if (!formData.start_time || !formData.end_time) {
      return { amount: 0, breakdown: [], hasTime: false }
    }
    const { amount, breakdown } = computeBookingAmount(
      formData.start_time,
      formData.end_time,
      { sound: formData.addon_sound, led: formData.addon_led },
      rateConfig
    )
    return { amount, breakdown, hasTime: true }
  }, [formData.start_time, formData.end_time, formData.addon_sound, formData.addon_led, facilityRates])

  // Real-time instant validation on date or time selection
  useEffect(() => {
    if (!formData.booking_date && !formData.start_time && !formData.end_time) return

    setValidationErrors(prev => {
      const next = { ...prev }
      if (formData.start_time && formData.end_time) {
        if (formData.start_time >= formData.end_time) {
          next.end_time = 'End time must be after start time'
        } else {
          delete next.end_time
          const isOverlap = existingBookings.some(b =>
            formData.start_time < b.end && formData.end_time > b.start
          )
          if (isOverlap) {
            next.start_time = 'This slot is occupied or blocked by an event.'
            next.end_time = 'This slot is occupied or blocked by an event.'
          } else {
            if (next.start_time === 'This slot is occupied or blocked by an event.') delete next.start_time
            if (next.end_time === 'This slot is occupied or blocked by an event.') delete next.end_time
          }
        }
      }
      return next
    })
  }, [formData.booking_date, formData.start_time, formData.end_time, existingBookings])

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.booking_date) errors.booking_date = 'Date is required'
    if (!formData.start_time) errors.start_time = 'Start time is required'
    if (!formData.end_time) errors.end_time = 'End time is required'

    if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
      errors.end_time = 'End time must be after start time'
    } else if (formData.start_time && formData.end_time && formData.booking_date) {
      const isOverlap = existingBookings.some(b =>
        formData.start_time < b.end &&
        formData.end_time > b.start
      )
      if (isOverlap) {
        errors.start_time = 'This slot is occupied or blocked by an event.'
        errors.end_time = 'This slot is occupied or blocked by an event.'
      }
    }

    if (formData.contact_number) {
      const phPhoneRegex = /^((09|\+639)\d{9}|0[2-8]\d{8})$/
      if (!phPhoneRegex.test(formData.contact_number.replace(/[-\s()]/g, ''))) {
        errors.contact_number = 'Invalid Philippine phone or landline format'
      }
    }

    if (formData.expected_attendees) {
      const count = parseInt(formData.expected_attendees)
      if (isNaN(count) || count < 1) {
        errors.expected_attendees = 'Please enter a valid number of attendees'
      } else if (count > 200) {
        errors.expected_attendees = 'Maximum capacity is 200 persons'
      }
    }

    if (!formData.purpose.trim()) errors.purpose = 'Purpose is required'
    else if (formData.purpose.trim().length < 10) errors.purpose = 'Please provide more detail (at least 10 characters)'
    if (!formData.event_name.trim()) errors.event_name = 'Event/Activity name is required'

    const todayStr = new Date().toISOString().slice(0, 10)
    if (formData.booking_date && formData.booking_date < todayStr)
      errors.booking_date = 'Booking date cannot be in the past'

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async () => {
    if (!selectedFacility) return
    if (!validate()) return

    setSubmitting(true)
    setSubmitError(null)
    setSubmitResult(null)

    try {
      const recurringNote = formData.is_recurring ? '[Recurring event] ' : ''
      const special = `${recurringNote}${formData.special_requests}`.trim()

      const body = {
        facility_id: selectedFacility.id,
        booking_date: formData.booking_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        booking_purpose: formData.booking_purpose,
        event_name: formData.event_name || undefined,
        purpose: formData.purpose,
        expected_attendees: formData.expected_attendees ? parseInt(formData.expected_attendees) : undefined,
        special_requests: special || undefined,
        organization_name: formData.organization_name || undefined,
        contact_number: formData.contact_number || undefined,
        addon_sound: formData.addon_sound || undefined,
        addon_led: formData.addon_led || undefined,
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data?.error ?? 'Failed to submit booking. Please try again.')
        return
      }

      setSubmitResult(data as GymBookingResult)
      setFormData(DEFAULT_FORM)
    } catch {
      setSubmitError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setFormData(DEFAULT_FORM)
    setSubmitResult(null)
    setSubmitError(null)
    setValidationErrors({})
  }

  return {
    // Facility selection
    rentableFacilities,
    selectedFacility,
    selectedFacilityId,
    selectFacility,
    loadingFacilities,
    facilityError,
    // Rates
    facilityRates,
    loadingRates,
    // Form
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
    // Legacy alias
    gymnasium: selectedFacility,
    loadingFacility: loadingFacilities,
  }
}

// Legacy alias so existing imports don't break
export const useGymBookingForm = () => useRentalBookingForm()
