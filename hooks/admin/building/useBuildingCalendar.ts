'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { BuildingCalendarEvent, BuildingFacility } from '@/backend/admin/building/building.types'

function localDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    startDate: localDateStr(start),
    endDate: localDateStr(end),
  }
}

export const useBuildingCalendar = (initialStartDate?: string, initialEndDate?: string) => {
  const { toast } = useToast()
  const today = new Date()
  const { startDate: currentMonthStart, endDate: currentMonthEnd } = getMonthRange(today)

  const [events, setEvents] = useState<BuildingCalendarEvent[]>([])
  const [facilities, setFacilities] = useState<BuildingFacility[]>([])
  const [facilityFilter, setFacilityFilter] = useState('')
  const [monthStart, setMonthStart] = useState(initialStartDate || currentMonthStart)
  const [monthEnd, setMonthEnd] = useState(initialEndDate || currentMonthEnd)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Track the abort controller to cancel stale requests
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchEvents = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true)
    setError(null)
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (facilityFilter && facilityFilter !== 'all') params.set('facilityId', facilityFilter)

      const res = await fetch(`/api/admin/building/calendar?${params.toString()}`, {
        signal: abortController.signal
      })
      if (!res.ok) throw new Error('Failed to fetch calendar events')
      const data = await res.json()
      setEvents(data.events || [])
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(err.message)
    } finally {
      if (abortControllerRef.current === abortController) {
        setLoading(false)
      }
    }
  }, [facilityFilter])

  const createEvent = useCallback(async (payload: {
    title: string
    date: string
    startTime: string
    endTime: string
    facilityId?: string
    reason?: string
    type?: string
  }) => {
    try {
      const res = await fetch('/api/admin/building/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create event')
      }

      const data = await res.json()
      toast({ title: 'Success', description: `Event "${payload.title}" created` })
      await fetchEvents(monthStart, monthEnd)
      return data.event
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      throw err
    }
  }, [monthStart, monthEnd, fetchEvents, toast])

  const fetchFacilities = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/building/facilities?pageSize=200')
      if (res.ok) {
        const data = await res.json()
        setFacilities(data.facilities || [])
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchFacilities() }, [fetchFacilities])

  useEffect(() => {
    fetchEvents(monthStart, monthEnd)
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [monthStart, monthEnd, fetchEvents])

  const goToPreviousMonth = () => {
    const date = new Date(monthStart)
    date.setMonth(date.getMonth() - 1)
    const { startDate, endDate } = getMonthRange(date)
    setMonthStart(startDate)
    setMonthEnd(endDate)
  }

  const goToNextMonth = () => {
    const date = new Date(monthStart)
    date.setMonth(date.getMonth() + 1)
    const { startDate, endDate } = getMonthRange(date)
    setMonthStart(startDate)
    setMonthEnd(endDate)
  }

  return {
    events, facilities, facilityFilter, setFacilityFilter,
    loading, error, fetchEvents,
    monthStart, monthEnd, setMonthStart, setMonthEnd,
    goToPreviousMonth, goToNextMonth,
    createEvent, refresh: () => fetchEvents(monthStart, monthEnd),
  }
}
