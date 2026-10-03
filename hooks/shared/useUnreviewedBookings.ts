'use client'

import { useState, useEffect, useCallback } from 'react'

export interface UnreviewedBooking {
  id: string
  bookingReference: string
  bookingDate: string
  startTime: string
  endTime: string
  purpose: string
  eventName: string | null
  facilities: { id: string; name: string; roomNumber: string | null }[]
}

export function useUnreviewedBookings() {
  const [bookings, setBookings] = useState<UnreviewedBooking[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch('/api/bookings/unreviewed')
      const data = await res.json()
      if (res.ok) setBookings(data.bookings || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  return { bookings, loading, refetch: fetchBookings }
}
