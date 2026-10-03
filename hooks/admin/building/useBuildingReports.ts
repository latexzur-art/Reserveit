'use client'

import { useState, useCallback, useEffect } from 'react'
import type { BuildingReportStats } from '@/backend/admin/building/building.types'

export interface ChartData {
  bookingTrends: Array<{ name: string; internal: number; external: number; total: number }>
  revenueTrends: Array<{ name: string; revenue: number }>
  peakHours: Array<{ hour: string; usage: number }>
  facilityUtilization: Array<{ name: string; bookings: number }>
  facilityTypes: Array<{ name: string; value: number }>
  bookingTypeDistribution: Array<{ name: string; value: number }>
}

export interface AnalyticsBundle {
  heatmap: Array<{ day: string; hour: string; density: number; count: number }>
  departmental: Array<{ name: string; value: number }>
  yield: Array<{ id: string; name: string; utilization: number; ghostRate: number; bookings: number }>
  forecast: {
    series: Array<{ name: string; volume: number | null; forecast: number | null }>
    maxCapacity: number
    forecastedPeak: number
  }
  maintenance: Array<{ id: string; name: string; cumulativeHours: number; maxSafeHours: number; wearPercent: number }>
  insights: Array<{ id: string; severity: 'warning' | 'alert' | 'tip'; icon: string; title: string; body: string }>
}

export const useBuildingReports = () => {
  const [stats, setStats] = useState<BuildingReportStats>({
    totalBookings: 0, totalRevenue: 0, avgUtilization: 0, completionRate: 0,
  })
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/building/reports/stats')
      if (!res.ok) throw new Error('Failed to fetch report stats')
      const data = await res.json()
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report stats')
    }
  }, [])

  const fetchChartData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/building/reports/charts')
      if (!res.ok) throw new Error('Failed to fetch chart data')
      const data = await res.json()
      setChartData(data.chartData)
    } catch (err) {
      console.error('Chart data fetch error:', err instanceof Error ? err.message : err)
    }
  }, [])

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/building/reports/analytics')
      if (!res.ok) throw new Error('Failed to fetch analytics')
      const data = await res.json()
      setAnalytics(data.analytics)
    } catch (err) {
      console.error('Analytics fetch error:', err instanceof Error ? err.message : err)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchStats(), fetchChartData(), fetchAnalytics()])
    setLoading(false)
  }, [fetchStats, fetchChartData, fetchAnalytics])

  useEffect(() => {
    let active = true
    // Initial load. `loading` starts as `true`, so we defer all work past an
    // await boundary — no setState runs synchronously inside the effect body.
    const load = async () => {
      await Promise.resolve()
      if (!active) return
      await Promise.all([fetchStats(), fetchChartData(), fetchAnalytics()])
      if (active) setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [fetchStats, fetchChartData, fetchAnalytics])

  return { stats, chartData, analytics, loading, error, refresh }
}
