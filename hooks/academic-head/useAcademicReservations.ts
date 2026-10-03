'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface AcademicReservationItem {
  id: string
  referenceNumber: string
  bookingDate: string
  startTime: string
  endTime: string
  durationMinutes: number | null
  status: string
  bookingPurpose: string
  purpose: string
  eventName: string | null
  expectedAttendees: number | null
  decisionScore: number | null
  createdAt: string
  mismatchFlag: string | null
  courseCode: string | null
  courseDepartmentCode: string | null
  courseName: string | null
  sessionType: string | null
  facultyId: string | null
  facultyName: string
  facultyEmail: string | null
  departmentId: string | null
  department: string
  departmentCode: string | null
  facilityId: string | null
  facilityName: string
  roomNumber: string | null
  floorNumber: number | null
  buildingName: string | null
}

export interface DeptOption {
  id: string
  code: string
  name: string
  activeBookings?: number
  primaryRooms?: number
}

export type SortBy = 'date_asc' | 'date_desc' | 'status' | 'department'

export function useAcademicReservations() {
  const { toast } = useToast()

  // Filter state
  const [statusFilter, setStatusFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('date_asc')
  const [page, setPage] = useState(1)

  // Data state
  const [bookings, setBookings] = useState<AcademicReservationItem[]>([])
  const [departments, setDepartments] = useState<DeptOption[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(id)
  }, [search])

  const cancelBooking = useCallback(async (id: string, reason: string): Promise<void> => {
    const res = await fetch('/api/academic-head/cancel-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: id, reason }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to cancel booking')
    }
  }, [])

  const reviewBooking = useCallback(async (id: string, action: 'approve' | 'reject', reason: string): Promise<void> => {
    const res = await fetch('/api/academic-head/review-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: id, action, reason }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? `Failed to ${action} booking`)
    }
  }, [])

  const proposeChanges = useCallback(async (id: string, changes: {
    proposed_date?: string
    proposed_start_time?: string
    proposed_end_time?: string
    proposed_facility_id?: string
    reason: string
  }): Promise<void> => {
    const res = await fetch('/api/academic-head/propose-changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: id, ...changes }),
    })
    if (!res.ok) {
      const data = await res.json()
      // 409 carries conflicting_booking_reference — surface it in the thrown message
      // so the propose-changes drawer can render it inline.
      const ref = data?.conflicting_booking_reference
      const base = data?.error ?? 'Failed to propose changes'
      throw new Error(ref ? `${base} (conflicts with ${ref})` : base)
    }
  }, [])

  const deleteBooking = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/academic-head/bookings/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to delete booking')
    }
  }, [])

  const bulkDeleteBookings = useCallback(async (ids: string[]): Promise<number> => {
    const res = await fetch('/api/academic-head/bookings/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to bulk delete bookings')
    }
    const data = await res.json()
    return data.deleted ?? 0
  }, [])

  const fetchReservations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20', sort_by: sortBy })
      if (statusFilter) params.set('status', statusFilter)
      if (fromDate) params.set('from_date', fromDate)
      if (toDate) params.set('to_date', toDate)
      if (departmentId) params.set('department_id', departmentId)
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/academic-head/reservations?${params}`)
      if (!res.ok) throw new Error('Failed to fetch reservations')
      const data = await res.json()

      setBookings(data.bookings ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
      if (data.departments?.length) setDepartments(data.departments)
    } catch {
      toast({ title: 'Error', description: 'Failed to load reservations.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, fromDate, toDate, departmentId, debouncedSearch, sortBy, toast])

  useEffect(() => {
    fetchReservations()
  }, [fetchReservations])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [statusFilter, fromDate, toDate, departmentId, debouncedSearch, sortBy])

  return {
    bookings,
    departments,
    total,
    totalPages,
    page,
    setPage,
    loading,
    statusFilter,
    setStatusFilter,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    departmentId,
    setDepartmentId,
    search,
    setSearch,
    sortBy,
    setSortBy,
    refresh: fetchReservations,
    cancelBooking,
    reviewBooking,
    proposeChanges,
    deleteBooking,
    bulkDeleteBookings,
  }
}
