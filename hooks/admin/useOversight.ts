'use client'

import { useState, useEffect, useCallback } from 'react'

export interface OversightBooking {
  id: string
  booking_reference: string
  booking_date: string
  start_time: string
  end_time: string
  booking_purpose: string
  purpose: string
  current_status: 'auto_approved' | 'flagged'
  decision_score: number | null
  oversight_expires_at: string
  created_at: string
  user: {
    id: string
    full_name: string
    email: string
    user_type: string
    account_status: string
  }
  booking_facilities: Array<{
    facility: {
      id: string
      name: string
      room_number: string | null
      floors: { floor_number: number; buildings: { name: string } }
    }
  }>
  booking_decisions: Array<{
    final_score: number
    decision: string
    decision_reason: string
    score_adjustments: Array<{ code: string; name: string; points: number; reason: string }>
  }>
}

export interface RestrictedUser {
  id: string
  full_name: string
  email: string
  account_status: 'restricted' | 'probation'
  consecutive_cancellations: number
  restricted_at: string | null
  restricted_reason: string | null
  appeal_reason: string | null
  appeal_submitted_at: string | null
  probation_started_at: string | null
}

export function useOversight() {
  const [oversightBookings, setOversightBookings] = useState<OversightBooking[]>([])
  const [restrictedUsers, setRestrictedUsers] = useState<RestrictedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setError(null)
    try {
      const [oversightRes, restrictedRes] = await Promise.all([
        fetch('/api/admin/oversight'),
        fetch('/api/admin/restricted-users'),
      ])

      if (!oversightRes.ok) throw new Error('Failed to fetch oversight data')
      if (!restrictedRes.ok) throw new Error('Failed to fetch restricted users')

      const [oversightData, restrictedData] = await Promise.all([
        oversightRes.json(),
        restrictedRes.json(),
      ])

      setOversightBookings(oversightData.bookings ?? [])
      setRestrictedUsers(restrictedData.users ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  return {
    oversightBookings,
    restrictedUsers,
    loading,
    error,
    refetch: fetchData,
    // Derived counts for stat cards
    oversightCount: oversightBookings.length,
    flaggedCount: oversightBookings.filter((b) => b.current_status === 'flagged').length,
    restrictedCount: restrictedUsers.filter((u) => u.account_status === 'restricted').length,
    probationCount: restrictedUsers.filter((u) => u.account_status === 'probation').length,
  }
}
