'use client'

import { useState, useEffect } from 'react'

export interface StaffScheduleClass {
  id: string
  course_code: string
  course_name: string
  section: string
  instructor_name: string | null
  day_of_week: number
  start_time: string
  end_time: string
  effective_start_date: string | null
  effective_end_date: string | null
  facility: {
    id: string | null
    name: string
    room_number: string
    building: string
  }
  department: {
    id: string | null
    name: string
    code: string
  }
}

export interface StaffScheduleMeta {
  total_classes: number
  unique_courses: number
  departments: Array<{ id: string; name: string; code: string }>
}

export function useStaffSchedules(staffId: string | null) {
  const [schedules, setSchedules] = useState<StaffScheduleClass[]>([])
  const [meta, setMeta] = useState<StaffScheduleMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!staffId) {
      setSchedules([])
      setMeta(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/academic-head/staff-schedules/${staffId}`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Failed to load schedules')
        }
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setSchedules(data.classes ?? [])
        setMeta(data.meta ?? null)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message ?? 'Unknown error')
        setSchedules([])
        setMeta(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [staffId])

  const refetch = async () => {
    if (!staffId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/academic-head/staff-schedules/${staffId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to load schedules')
      }
      const data = await res.json()
      setSchedules(data.classes ?? [])
      setMeta(data.meta ?? null)
    } catch (err: any) {
      setError(err.message ?? 'Unknown error')
      setSchedules([])
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }

  return { schedules, meta, loading, error, refetch }
}
