'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FacilityReview, FacilityIssueReport, ReviewStatus } from '@/backend/admin/building/building.types'
import { useToast } from '@/hooks/use-toast'

export interface ReviewModerationFilters {
  facilityId?: string
  rating?: number
  status?: ReviewStatus
  hasIssue?: boolean
}

export function useFacilityModeration() {
  const [reviews, setReviews] = useState<FacilityReview[]>([])
  const [total, setTotal] = useState(0)
  const [issueReports, setIssueReports] = useState<FacilityIssueReport[]>([])
  const [filters, setFilters] = useState<ReviewModerationFilters>({})
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchReviews = useCallback(async () => {
    const params = new URLSearchParams()
    if (filters.facilityId) params.set('facilityId', filters.facilityId)
    if (filters.rating) params.set('rating', String(filters.rating))
    if (filters.status) params.set('status', filters.status)
    if (filters.hasIssue !== undefined) params.set('hasIssue', String(filters.hasIssue))

    const res = await fetch(`/api/admin/building/reviews?${params}`)
    const data = await res.json()
    if (res.ok) {
      setReviews(data.reviews || [])
      setTotal(data.total || 0)
    }
  }, [filters])

  const fetchIssueReports = useCallback(async () => {
    const res = await fetch('/api/admin/building/issue-reports')
    const data = await res.json()
    if (res.ok) setIssueReports(data.reports || [])
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchReviews(), fetchIssueReports()]).finally(() => setLoading(false))
  }, [fetchReviews, fetchIssueReports])

  const moderateReview = useCallback(async (id: string, status: ReviewStatus) => {
    try {
      const res = await fetch(`/api/admin/building/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update review')
      toast({ title: 'Review updated', description: `Marked as ${status}.` })
      await fetchReviews()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }, [fetchReviews, toast])

  const postWarningFromIssue = useCallback(async (report: FacilityIssueReport, severity: 'info' | 'warning' | 'critical' = 'warning') => {
    try {
      const res = await fetch(`/api/admin/building/facilities/${report.facilityId}/warnings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity, message: `[${report.category}] ${report.details || 'Reported issue'}` }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to post warning')
      toast({ title: 'Warning posted', description: 'Active room warning is now live.' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }, [toast])

  const convertToMaintenance = useCallback(async (reportId: string) => {
    try {
      const res = await fetch(`/api/admin/building/issue-reports/${reportId}/convert`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to convert to maintenance')
      toast({ title: 'Converted', description: 'Maintenance record created.' })
      await fetchIssueReports()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }, [fetchIssueReports, toast])

  const dismissIssueReport = useCallback(async (reportId: string) => {
    try {
      const res = await fetch(`/api/admin/building/issue-reports/${reportId}/dismiss`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to dismiss report')
      toast({ title: 'Dismissed', description: 'Issue report dismissed.' })
      await fetchIssueReports()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }, [fetchIssueReports, toast])

  return {
    reviews, total, issueReports, filters, setFilters, loading,
    moderateReview, postWarningFromIssue, convertToMaintenance, dismissIssueReport,
    refetch: () => Promise.all([fetchReviews(), fetchIssueReports()]),
  }
}
