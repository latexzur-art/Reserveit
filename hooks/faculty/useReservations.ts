'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface PendingProposal {
  override_id: string
  action: string
  proposed_date: string | null
  proposed_start_time: string | null
  proposed_end_time: string | null
  proposed_facility_id: string | null
  reason: string
  created_at: string
}

export interface PendingEmergencyRequest {
  id: string
  created_at: string
}

export interface LastDeniedEmergencyRequest {
  id: string
  reviewed_at: string
  review_notes: string | null
}

export interface PendingRescheduleRequest {
  id: string
  status: string
  proposed_date: string
  proposed_start_time: string
  proposed_end_time: string
  extra_amount_centavos: number
  extra_payment_id: string | null
  created_at: string
}

export interface LastDeclinedRescheduleRequest {
  id: string
  reviewed_at: string
  review_notes: string | null
  proposed_date: string
  proposed_start_time: string
  proposed_end_time: string
}

export interface ReservationItem {
  id: string
  booking_reference: string
  booking_date: string
  start_time: string
  end_time: string
  current_status: string
  booking_purpose: string
  booking_type: string
  purpose: string
  expected_attendees: number | null
  facility_id: string | null
  facility_name: string
  building_name: string
  room_number: string
  mismatch_flag: string | null
  mismatch_alternative_facility_id: string | null
  mismatch_alternative_facility: { id: string; name: string; room_number: string | null } | null
  mismatch_reviewer: { id: string; name: string; role: string | null } | null
  pending_proposal: PendingProposal | null
  requires_payment: boolean
  is_extension: boolean
  extension_of_booking_id: string | null
  metadata: Record<string, unknown>
  course_code: string | null
  course_department_code: string | null
  course_name: string | null
  is_elective: boolean
  elective_type: string | null
  session_type: string | null
  has_completed_payment: boolean
  pending_emergency_request: PendingEmergencyRequest | null
  last_denied_emergency_request: LastDeniedEmergencyRequest | null
  pending_reschedule_request: PendingRescheduleRequest | null
  last_declined_reschedule_request: LastDeclinedRescheduleRequest | null
  cancellation_proposal: { id: string; reason: string; refund_amount_centavos: number; created_at: string } | null
}

function mapProposal(overrides: any[]): PendingProposal | null {
  if (!overrides?.length) return null
  // Pick the most recent override (already sorted by created_at desc from the API)
  const o = overrides.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  const nv = o.new_values ?? {}
  return {
    override_id: o.id,
    action: o.override_action,
    proposed_date: nv.booking_date ?? null,
    proposed_start_time: nv.start_time ?? null,
    proposed_end_time: nv.end_time ?? null,
    proposed_facility_id: nv.facility_id ?? null,
    reason: o.reason,
    created_at: o.created_at,
  }
}

function mapBooking(b: any): ReservationItem {
  const facility = b.booking_facilities?.[0]?.facility
  return {
    id: b.id,
    booking_reference: b.booking_reference,
    booking_date: b.booking_date,
    start_time: b.start_time?.slice(0, 5) ?? '',
    end_time: b.end_time?.slice(0, 5) ?? '',
    current_status: b.current_status,
    booking_purpose: b.booking_purpose,
    booking_type: b.booking_type ?? 'internal_free',
    purpose: b.purpose,
    expected_attendees: b.expected_attendees ?? null,
    facility_id: facility?.id ?? null,
    facility_name: facility?.name ?? 'Unknown Facility',
    building_name: facility?.floors?.buildings?.name ?? '',
    room_number: facility?.room_number ?? '',
    mismatch_flag: b.mismatch_flag ?? null,
    mismatch_alternative_facility_id: b.mismatch_alternative_facility_id ?? null,
    mismatch_alternative_facility: b.mismatch_alternative_facility ?? null,
    mismatch_reviewer: b.mismatch_reviewer ?? null,
    pending_proposal: (b.current_status === 'pending_faculty_response' || b.current_status === 'pending_user_response')
      ? mapProposal(b.booking_overrides)
      : null,
    requires_payment: b.requires_payment ?? false,
    is_extension: b.is_extension ?? false,
    extension_of_booking_id: b.extension_of_booking_id ?? null,
    metadata: b.metadata ?? {},
    course_code: b.booking_course_code ?? null,
    course_department_code: b.booking_department_code ?? null,
    course_name: b.course_name ?? null,
    is_elective: b.is_elective ?? false,
    elective_type: b.elective_type ?? null,
    session_type: b.session_type ?? null,
    has_completed_payment: b.has_completed_payment ?? false,
    pending_emergency_request: b.pending_emergency_request ?? null,
    last_denied_emergency_request: b.last_denied_emergency_request ?? null,
    pending_reschedule_request: b.pending_reschedule_request ?? null,
    last_declined_reschedule_request: b.last_declined_reschedule_request ?? null,
    cancellation_proposal: b.cancellation_proposal ?? null,
  }
}

export function useReservations(options: { scope?: 'all' } = {}) {
  const { scope } = options
  const [bookings, setBookings] = useState<ReservationItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const { toast } = useToast()
  const pageSize = 10

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (statusFilter) params.set('status', statusFilter)
      if (scope) params.set('scope', scope)
      params.set('_t', Date.now().toString()) // Cache busting

      const res = await fetch(`/api/bookings?${params}`)
      if (!res.ok) throw new Error('Failed to fetch bookings')
      const data = await res.json()
      setBookings((data.bookings ?? []).map(mapBooking))
      setTotal(data.total ?? 0)
    } catch {
      toast({ title: 'Error', description: 'Failed to load reservations.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, scope, toast])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Reset to page 1 when filter changes
  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  const respondToAlternative = useCallback(async (id: string, accept: boolean): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bookings/${id}/accept-alternative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process response')
      }

      if (accept && data.status === 'cancelled') {
        toast({
          title: 'Booking Cancelled',
          description: data.message || 'The booking was cancelled.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: accept ? 'Alternative Accepted' : 'Booking Declined',
          description: accept
            ? 'Your booking has been moved to the alternative facility.'
            : 'The booking has been cancelled.',
        })
      }

      await fetchBookings()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchBookings, toast])

  const cancelBooking = useCallback(async (id: string, reason?: string) => {
    setCancelling(id)
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to cancel booking')
      }
      // Optimistic update
      setBookings(prev =>
        prev.map(b => b.id === id ? { ...b, current_status: 'cancelled' } : b)
      )
      toast({ title: 'Booking Cancelled', description: 'Your reservation has been cancelled.' })
    } catch (err: any) {
      toast({ title: 'Cancel Failed', description: err.message, variant: 'destructive' })
    } finally {
      setCancelling(null)
    }
  }, [toast])

  const requestCancellation = useCallback(async (id: string, reason: string) => {
    setCancelling(id)
    try {
      const res = await fetch(`/api/bookings/${id}/request-cancellation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to submit cancellation request')
      }
      // Optimistic update
      setBookings(prev =>
        prev.map(b => b.id === id ? { ...b, current_status: 'cancellation_requested' } : b)
      )
      toast({ title: 'Cancellation Requested', description: 'Your request has been submitted for review by the Academic Head.' })
    } catch (err: any) {
      toast({ title: 'Request Failed', description: err.message, variant: 'destructive' })
    } finally {
      setCancelling(null)
    }
  }, [toast])

  const respondToEmergency = useCallback(async (bookingId: string, action: 'accept' | 'decline_convert_to_credit') => {
    setRespondingId(bookingId)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/emergency-respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to respond')
      toast({
        title: action === 'accept' ? 'Reschedule Accepted' : 'Credit Issued',
        description: data.message,
      })
      await fetchBookings()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setRespondingId(null)
    }
  }, [fetchBookings, toast])

  const submitEmergencyRequest = useCallback(async (bookingId: string, reason: string, attachmentUrl?: string | null): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/emergency-cancellation-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, attachment_url: attachmentUrl ?? undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to submit request')
      toast({ title: 'Request Submitted', description: data.message })
      await fetchBookings()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchBookings, toast])

  const withdrawEmergencyRequest = useCallback(async (bookingId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/emergency-cancellation-request`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to withdraw request')
      toast({ title: 'Request Withdrawn', description: data.message })
      await fetchBookings()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchBookings, toast])

  const submitRescheduleRequest = useCallback(async (
    bookingId: string,
    data: {
      reason: string
      attachmentUrl?: string
      proposedDate: string
      proposedStartTime: string
      proposedEndTime: string
    }
  ): Promise<{ success: boolean; extraAmountCentavos?: number }> => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/emergency-reschedule-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: data.reason,
          attachment_url: data.attachmentUrl ?? undefined,
          proposed_date: data.proposedDate,
          proposed_start_time: data.proposedStartTime,
          proposed_end_time: data.proposedEndTime,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to submit request')
      toast({ title: 'Request Submitted', description: json.message })
      await fetchBookings()
      return { success: true, extraAmountCentavos: json.extraAmountCentavos ?? 0 }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return { success: false }
    }
  }, [fetchBookings, toast])

  const withdrawRescheduleRequest = useCallback(async (bookingId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/emergency-reschedule-request`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to withdraw request')
      toast({ title: 'Request Withdrawn', description: json.message })
      await fetchBookings()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchBookings, toast])

  const respondToProposal = useCallback(async (bookingId: string, action: 'accept' | 'decline') => {
    try {
      const res = await fetch('/api/academic-head/respond-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, action }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to process response')
      }
      toast({
        title: action === 'accept' ? 'Changes Accepted' : 'Booking Cancelled',
        description: action === 'accept'
          ? 'The proposed changes have been applied to your booking.'
          : 'You declined the proposed changes. Your booking has been cancelled. Please create a new reservation if needed.',
      })
      await fetchBookings()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }, [fetchBookings, toast])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    bookings,
    total,
    page,
    setPage,
    totalPages,
    statusFilter,
    setStatusFilter,
    loading,
    cancelling,
    cancelBooking,
    requestCancellation,
    respondToAlternative,
    respondToProposal,
    respondToEmergency,
    submitEmergencyRequest,
    withdrawEmergencyRequest,
    submitRescheduleRequest,
    withdrawRescheduleRequest,
    respondingId,
    refresh: fetchBookings,
  }
}
