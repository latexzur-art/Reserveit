import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { UserDistributionData, KeyMetricsData } from '@/backend/admin/admin.types'

export const useAdminReports = () => {
  const [distribution, setDistribution] = useState<UserDistributionData | null>(null)
  const [metrics, setMetrics] = useState<KeyMetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30d')
  const { toast } = useToast()

  // Fetch distribution data
  const fetchDistribution = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reports/distribution')
      if (!res.ok) throw new Error('Failed to fetch distribution data')
      const data = await res.json()
      setDistribution(data)
    } catch (error: any) {
      console.error('Error fetching distribution:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to load distribution data',
        variant: 'destructive',
      })
    }
  }, [toast])

  // Fetch metrics data
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/reports/metrics')
      if (!res.ok) throw new Error('Failed to fetch metrics data')
      const data = await res.json()
      setMetrics(data)
    } catch (error: any) {
      console.error('Error fetching metrics:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to load metrics data',
        variant: 'destructive',
      })
    }
  }, [toast])

  // Export report as CSV
  const exportReport = useCallback(async (reportType: 'distribution' | 'metrics') => {
    try {
      const res = await fetch(`/api/admin/reports/export?type=${reportType}`)
      if (!res.ok) throw new Error('Failed to export report')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Success',
        description: 'Report exported successfully',
      })
    } catch (error: any) {
      console.error('Error exporting report:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to export report',
        variant: 'destructive',
      })
    }
  }, [toast])

  // Refresh all data
  const refresh = useCallback(() => {
    setLoading(true)
    Promise.all([fetchDistribution(), fetchMetrics()]).finally(() => {
      setLoading(false)
    })
  }, [fetchDistribution, fetchMetrics])

  // Initial load
  useEffect(() => {
    refresh()
  }, []) // Only run once on mount

  return {
    distribution,
    metrics,
    loading,
    dateRange,
    setDateRange,
    exportReport,
    refresh,
  }
}
