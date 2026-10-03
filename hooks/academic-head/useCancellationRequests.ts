'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface CancellationRequest {
  id: string
  booking_id: string
  user_id: string
  reason: string
  status: string
  original_status: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  auto_approved: boolean
  refund_window_met: boolean | null
  refund_destination_name: string | null
  refund_destination_contact_number: string | null
  refund_destination_qr_url?: string | null
  created_at: string
  users: { full_name: string; email: string } | null
  bookings: {
    booking_reference: string
    booking_date: string
    start_time: string
    end_time: string
    current_status: string
    booking_facilities: Array<{ facility_id: string; facilities: { name: string } | null }>
  } | null
}

export type CancellationRespondAction = 'approve_no_strike' | 'approve_with_strike' | 'reject'

export function useCancellationRequests() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<CancellationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending')
  const [activeQrUrl, setActiveQrUrl] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/academic-head/cancellation-requests?status=${statusFilter}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setRequests(data.requests ?? [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load cancellation requests', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toast])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const respond = useCallback(async (requestId: string, action: CancellationRespondAction) => {
    setResponding(requestId)
    try {
      const res = await fetch(`/api/academic-head/cancellation-requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, review_notes: reviewNotes[requestId] || undefined }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to process')
      }
      toast({
        title: action === 'reject' ? 'Request Rejected' : 'Cancellation Approved',
        description: action === 'reject'
          ? 'The cancellation request has been rejected. The booking remains active.'
          : action === 'approve_with_strike'
            ? 'Cancellation approved with a strike applied to the user.'
            : 'Cancellation approved without a strike.',
      })
      await fetchRequests()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setResponding(null)
    }
  }, [fetchRequests, reviewNotes, toast])

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return {
    requests,
    loading,
    responding,
    reviewNotes,
    setReviewNotes,
    statusFilter,
    setStatusFilter,
    activeQrUrl,
    setActiveQrUrl,
    refresh: fetchRequests,
    respond,
    pendingCount,
  }
}
