'use client'

import { useState, useEffect, useCallback } from 'react'
import { computeBookingAmount, type CostLineItem, type RateConfig } from '@/backend/booking/computeBookingAmount'
import type { FacilityRates } from '@/backend/admin/building'

export interface GymFacility {
  id: string
  name: string
  capacity: number | null
  room_number: string | null
  is_available_for_rental?: boolean
  facility_types?: { name: string }
  floors?: { floor_number: number }
}

export interface InternalGymBookingFormData {
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
  addon_other_ids: string[]
}

export interface GymBookingResult {
  status: string
  booking_id: string
  booking_reference: string
  requires_payment: boolean
  message: string
}

const DEFAULT_FORM: InternalGymBookingFormData = {
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
  addon_other_ids: [],
}

export interface LiveCost {
  amount: number
  breakdown: CostLineItem[]
  hasTime: boolean
}

export function useInternalGymBookingForm(facilityId?: string) {
  // All rentable facilities (for the selection screen when no facilityId given)
  const [rentableFacilities, setRentableFacilities] = useState<GymFacility[]>([])
  const [gymnasium, setGymnasium] = useState<GymFacility | null>(null)
  const [loadingFacility, setLoadingFacility] = useState(true)
  const [facilityError, setFacilityError] = useState<string | null>(null)

  // DB-fetched rates for cost calculation
  const [facilityRates, setFacilityRates] = useState<FacilityRates | null>(null)
  const [loadingRates, setLoadingRates] = useState(false)

  const [formData, setFormData] = useState<InternalGymBookingFormData>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<GymBookingResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const [existingBookings, setExistingBookings] = useState<{ date: string; start: string; end: string; reason: string }[]>([])

  // Fetch all rentable facilities + optionally resolve the selected one
  useEffect(() => {
    async function fetchFacilities() {
      try {
        const res = await fetch('/api/facilities?rental=true')
        if (!res.ok) throw new Error('Failed to load facilities')
        const data = await res.json()
        const all: GymFacility[] = data.facilities ?? data ?? []
        const rentable = all.filter(f => f.is_available_for_rental)
        setRentableFacilities(rentable)

        if (facilityId) {
          const found = rentable.find(f => f.id === facilityId)
          if (found) {
            setGymnasium(found)
          } else {
            setFacilityError('This facility is not available for rental booking.')
          }
        }
      } catch {
        setFacilityError('Unable to load facility information.')
      } finally {
        setLoadingFacility(false)
      }
    }
    fetchFacilities()
  }, [facilityId])

  // Fetch schedule/blocks when gymnasium is set
  useEffect(() => {
    if (!gymnasium) return
    fetch(`/api/facilities/${gymnasium.id}/schedule`)
      .then(r => r.json())
      .then(schedule => {
        const combined: { date: string; start: string; end: string; reason: string }[] = []
        if (schedule.school_events) {
          schedule.school_events.forEach((e: any) => {
            combined.push({ date: e.date, start: e.start, end: e.end, reason: 'School Event' })
          })
        }
        if (schedule.bookings) {
          schedule.bookings.forEach((b: any) => {
            combined.push({ date: b.date, start: b.start, end: b.end, reason: 'Already Booked' })
          })
        }
        if (schedule.blocks) {
          schedule.blocks.forEach((b: any) => {
            const startDate = new Date(b.start)
            const endDate = new Date(b.end)
            combined.push({
              date: startDate.toISOString().split('T')[0],
              start: startDate.toTimeString().slice(0, 5),
              end: endDate.toTimeString().slice(0, 5),
              reason: b.reason ?? 'Blocked',
            })
          })
        }
        setExistingBookings(combined)
      })
      .catch(() => {})
  }, [gymnasium?.id])

  // Fetch rates when gymnasium is resolved; re-fetch on tab focus to pick up admin changes
  useEffect(() => {
    const id = gymnasium?.id
    if (!id) {
      setFacilityRates(null)
      setLoadingRates(false)
      return
    }

    const fetchRates = () => {
      setLoadingRates(true)
      fetch(`/api/facilities/${id}/rates`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setFacilityRates(d))
        .catch(() => setFacilityRates(null))
        .finally(() => setLoadingRates(false))
    }

    fetchRates()

    const onVisible = () => { if (document.visibilityState === 'visible') fetchRates() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [gymnasium?.id])

  const updateField = useCallback(<K extends keyof InternalGymBookingFormData>(
    field: K,
    value: InternalGymBookingFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setValidationErrors(prev => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  // Build RateConfig from DB rates (falls back to hardcoded via computeBookingAmount defaults)
  const rateConfig: RateConfig | undefined = facilityRates
    ? {
        amRatePerHour: facilityRates.amRate ?? undefined,
        pmRatePerHour: facilityRates.pmRate ?? undefined,
        pmCutoffHour: facilityRates.amCutoffHour,
        addonSoundFee: facilityRates.addons.find(a => a.name.toLowerCase().includes('sound'))?.amount,
        addonLedFee: facilityRates.addons.find(a => a.name.toLowerCase().includes('led'))?.amount,
      }
    : undefined

  const liveCost: LiveCost = (() => {
    if (!formData.start_time || !formData.end_time) {
      return { amount: 0, breakdown: [], hasTime: false }
    }
    const { amount, breakdown } = computeBookingAmount(
      formData.start_time,
      formData.end_time,
      { sound: formData.addon_sound, led: formData.addon_led },
      rateConfig
    )
    const otherItems: CostLineItem[] = (facilityRates?.addons ?? [])
      .filter(a =>
        formData.addon_other_ids.includes(a.id) &&
        !a.name.toLowerCase().includes('sound') &&
        !a.name.toLowerCase().includes('led')
      )
      .map(a => ({ label: a.name, hours: 1, rate: a.amount, subtotal: a.amount, isFlatFee: true }))
    const extraAmount = otherItems.reduce((s, i) => s + i.subtotal, 0)
    return { amount: amount + extraAmount, breakdown: [...breakdown, ...otherItems], hasTime: true }
  })()

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.booking_date) errors.booking_date = 'Date is required'
    if (!formData.start_time) errors.start_time = 'Start time is required'
    if (!formData.end_time) errors.end_time = 'End time is required'

    if (formData.start_time && formData.end_time && formData.booking_date) {
      const crossesMidnight = formData.end_time <= formData.start_time
      const dayBlocks = existingBookings.filter(b => b.date === formData.booking_date)
      const isOverlap = dayBlocks.some(b => {
        if (crossesMidnight) {
          return formData.start_time < b.end || formData.end_time > b.start
        }
        return formData.start_time < b.end && formData.end_time > b.start
      })
      if (isOverlap) {
        errors.start_time = 'This time overlaps an existing booking or blocked slot.'
        errors.end_time = 'This time overlaps an existing booking or blocked slot.'
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

    if (formData.start_time && formData.end_time && formData.end_time <= formData.start_time)
      errors.end_time = 'End time must be after start time'

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
    if (!gymnasium) return
    if (!validate()) return

    setSubmitting(true)
    setSubmitError(null)
    setSubmitResult(null)

    try {
      const recurringNote = formData.is_recurring ? '[Recurring event] ' : ''
      const special = `${recurringNote}${formData.special_requests}`.trim()

      const body = {
        facility_id: gymnasium.id,
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
        addon_other_ids: formData.addon_other_ids.length ? formData.addon_other_ids : undefined,
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
  }
}
