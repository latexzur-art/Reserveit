'use client'

import { useState, useEffect } from 'react'

export interface StaffBooking {
  id: string
  referenceNumber: string
  bookingDate: string
  startTime: string
  endTime: string
  durationMinutes: number | null
  status: string
  bookingPurpose: string | null
  purpose: string | null
  eventName: string | null
  expectedAttendees: number | null
  facilityId: string | null
  facilityName: string
  roomNumber: string | null
  floorNumber: number | null
  buildingName: string | null
}

export function useStaffBookings(staffId: string | null) {
  const [bookings, setBookings] = useState<StaffBooking[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!staffId) {
      setBookings([])
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/academic-head/staff-bookings/${staffId}`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Failed to load bookings')
        }
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setBookings(data.bookings ?? [])
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message ?? 'Unknown error')
        setBookings([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [staffId])

  return { bookings, loading, error }
}
