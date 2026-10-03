'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface AlternativeFacility {
  id: string
  name: string
  room_number: string
  available: boolean
}

export interface MismatchReviewItem {
  bookingId: string
  referenceNumber: string
  currentStatus: string
  facultyName: string
  facultyId: string | null
  department: string
  departmentCode: string | null
  facility: {
    id: string
    name: string
    room_number: string
    floors: { floor_number: number; buildings: { name: string } | null } | null
  } | null
  bookingDate: string
  startTime: string
  endTime: string
  bookingPurpose: string
  facilityPurposeCategory: string | null
  mismatchJustification: string | null
  mismatchFlag: string | null
  // L4: score breakdown so the reviewer sees "why flagged" without re-investigating.
  scoreBreakdown: {
    baseScore: number | null
    finalScore: number | null
    adjustments: { code: string; name: string; points: number; reason: string }[]
    decisionReason: string | null
  } | null
  submittedAt: string
  alternativeFacilities: AlternativeFacility[]
  suggestedAlternative: {
    id: string
    name: string
    room_number: string
    floors: { floor_number: number; buildings: { name: string } | null } | null
  } | null
  reviewedBy: { name: string; role: string } | null
}

export type ReviewAction = 'approve' | 'decline' | 'suggest_alternative'

export function useMismatchReviews() {
  const [reviews, setReviews] = useState<MismatchReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/academic-head/mismatch-reviews')
      if (!res.ok) throw new Error('Failed to fetch reviews')
      const data = await res.json()
      setReviews(data.reviews ?? [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load mismatch reviews.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const submitReview = useCallback(async (
    bookingId: string,
    action: ReviewAction,
    options?: { alternativeFacilityId?: string; reviewerNotes?: string; alternativeDate?: string; alternativeStartTime?: string; alternativeEndTime?: string }
  ) => {
    setSubmitting(bookingId)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/mismatch-review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          alternative_facility_id: options?.alternativeFacilityId,
          reviewer_notes: options?.reviewerNotes,
          alternative_date: options?.alternativeDate || undefined,
          alternative_start_time: options?.alternativeStartTime || undefined,
          alternative_end_time: options?.alternativeEndTime || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to submit review')
      }
      const messages: Record<ReviewAction, string> = {
        approve: 'Booking has been approved.',
        decline: 'Booking has been declined.',
        suggest_alternative: 'Alternative facility suggested. Faculty has been notified.',
      }
      toast({ title: 'Review Submitted', description: messages[action] })
      await fetchReviews()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(null)
    }
  }, [fetchReviews, toast])

  // L2: batch-approve. Only meaningful for currentStatus === 'flagged' rows (the
  // 'approve' action requires the mismatch_flag path — pending_faculty_response rows
  // are already past that, waiting on the faculty, not the reviewer).
  const [batchApproving, setBatchApproving] = useState(false)
  const batchApprove = useCallback(async (bookingIds: string[], reviewerNotes?: string) => {
    if (bookingIds.length === 0) return
    setBatchApproving(true)
    try {
      const res = await fetch('/api/academic-head/mismatch-reviews/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_ids: bookingIds, reviewer_notes: reviewerNotes }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to batch-approve')
      }
      const data = await res.json()
      const failed = (data.results ?? []).filter((r: { ok: boolean }) => !r.ok)
      if (failed.length > 0) {
        toast({
          title: 'Batch approve completed with errors',
          description: `${data.approved} approved, ${data.failed} failed.`,
          variant: 'destructive',
        })
      } else {
        toast({ title: 'Batch Approve', description: `${data.approved} booking(s) approved.` })
      }
      await fetchReviews()
      return data
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setBatchApproving(false)
    }
  }, [fetchReviews, toast])

  return {
    reviews,
    loading,
    submitting,
    submitReview,
    refresh: fetchReviews,
    batchApprove,
    batchApproving,
  }
}
