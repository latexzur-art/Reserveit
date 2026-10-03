'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FacilityReview, IssueCategory } from '@/backend/admin/building/building.types'

export interface SubmitReviewInput {
  rating: number
  comment?: string
  bookingId?: string
  issueReported?: boolean
  issueCategory?: IssueCategory
}

export function useFacilityReviews(facilityId: string | null | undefined) {
  const [reviews, setReviews] = useState<FacilityReview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReviews = useCallback(async () => {
    if (!facilityId) {
      setReviews([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/facilities/${facilityId}/reviews`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch reviews')
      setReviews(data.reviews || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [facilityId])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const submitReview = useCallback(async (input: SubmitReviewInput) => {
    if (!facilityId) throw new Error('facilityId is required')
    const res = await fetch(`/api/facilities/${facilityId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to submit review')
    await fetchReviews()
    return data as FacilityReview
  }, [facilityId, fetchReviews])

  const averageRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null

  return { reviews, averageRating, loading, error, refetch: fetchReviews, submitReview }
}
