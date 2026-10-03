'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { DashboardStats } from '@/backend/admin/building/building.types'

interface TodayBooking {
  id: string
  bookingReference: string
  date: string
  startTime: string
  endTime: string
  status: string
  requester: string
  facilityName: string
  roomNumber: string
}

interface WeeklyData {
  day: string
  Bookings: number
}

interface MaintenanceItem {
  id: string
  type: string
  item: string
  scheduleDate: string
  status: string
}

interface OccupiedFacility {
  id: string
  roomNumber: string
  name: string
  status: string
  currentActivity: string
  currentUser: string
  timeLeft: string
}

export const useBuildingDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalFacilities: 0, totalBookings: 0, todaysBookings: 0,
    roomUtilization: 0, activeUsers: 0, pendingApprovals: 0,
  })
  const [todaysBookings, setTodaysBookings] = useState<TodayBooking[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([])
  const [occupiedFacilities, setOccupiedFacilities] = useState<OccupiedFacility[]>([])
  const [bookingDates, setBookingDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialLoadDone = useRef(false)

  const fetchAll = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true)
    setError(null)

    try {
      const [statsRes, todayRes, weeklyRes, maintRes, facilityRes] = await Promise.all([
        fetch('/api/admin/building/dashboard/stats'),
        fetch('/api/admin/building/dashboard/today'),
        fetch('/api/admin/building/dashboard/weekly'),
        fetch('/api/admin/building/dashboard/maintenance'),
        fetch('/api/admin/building/dashboard/facility-status'),
      ])

      if (!statsRes.ok || !todayRes.ok || !weeklyRes.ok || !maintRes.ok || !facilityRes.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const [statsData, todayData, weeklyDataRes, maintData, facilityData] = await Promise.all([
        statsRes.json(), todayRes.json(), weeklyRes.json(), maintRes.json(), facilityRes.json(),
      ])

      setStats(statsData)
      setTodaysBookings(todayData.bookings || [])
      setWeeklyData(weeklyDataRes.data || [])
      setMaintenance(maintData.maintenance || [])
      setOccupiedFacilities(facilityData.facilities || [])
      initialLoadDone.current = true
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCalendarDates = useCallback(async (year: number, month: number) => {
    try {
      const res = await fetch(`/api/admin/building/dashboard/calendar-dates?year=${year}&month=${month}`)
      if (res.ok) {
        const data = await res.json()
        setBookingDates(data.dates || [])
      }
    } catch {
      // Silent fail for calendar dates
    }
  }, [])

  useEffect(() => {
    fetchAll()

    // Poll every 60 seconds
    const interval = setInterval(fetchAll, 60000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Fetch calendar dates for current month on mount
  useEffect(() => {
    const now = new Date()
    fetchCalendarDates(now.getFullYear(), now.getMonth() + 1)
  }, [fetchCalendarDates])

  return {
    stats, todaysBookings, weeklyData, maintenance,
    occupiedFacilities, bookingDates, loading, error,
    refresh: fetchAll, fetchCalendarDates,
  }
}
