'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { BuildingBooking } from '@/backend/admin/building/building.types'

export type { BuildingBooking }
export type BookingAction = 'approve' | 'reject' | 'cancel';

export const useBuildingBookings = () => {
  const [bookings, setBookings] = useState<BuildingBooking[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { toast } = useToast()
  const supabase = useMemo(() => createSupabaseClient(), [])
  const abortRef = useRef<AbortController | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchBookings = useCallback(async () => {
    // Abort previous request if still in flight
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('type', typeFilter)
      params.set('page', String(currentPage))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/building/bookings?${params}`, { 
        signal: controller.signal 
      })
      
      if (!res.ok) throw new Error('Failed to fetch reservations')
      
      const data = await res.json()
      setBookings(data.bookings || [])
      setTotal(data.total || 0)
      setError(null)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message)
        toast({ title: "Sync Error", description: err.message, variant: "destructive" })
      }
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, typeFilter, currentPage, pageSize, toast])

  const exportCSV = useCallback(() => {
    if (bookings.length === 0) {
      toast({ title: "No data", description: "Nothing to export.", variant: "destructive" });
      return;
    }
    const headers = "Reference,Requester,Type,Facility,Date,Time,Status,Purpose,Course Code,Course Name,Elective\n";
    const rows = bookings.map(b =>
      `${b.bookingReference},${b.requesterName},${b.bookingType},"${b.facilities.map(f => f.name).join('; ')}",${b.bookingDate},${b.startTime}-${b.endTime},${b.currentStatus},"${b.purpose.replace(/"/g, '""')}",${b.courseCode ?? ''},"${(b.courseName ?? '').replace(/"/g, '""')}",${b.isElective ? b.electiveType ?? '' : ''}`
    ).join("\n");

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ReserveIT_Export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [bookings, toast]);

  const updateBookingStatus = useCallback(async (id: string, action: BookingAction, notes?: string) => {
    try {
      const res = await fetch(`/api/admin/building/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || errorData.message || 'Update failed')
      }

      toast({ title: "System Updated", description: `Reservation #${id.slice(0, 8)} has been ${action}.` })
      fetchBookings()
      return true
    } catch (err: any) {
      toast({ title: 'Update Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchBookings, toast])

  // Real-time listener: Auto-refresh list when DB changes
  useEffect(() => {
    const channel = supabase.channel('reservations-live')
      .on('postgres_changes', { 
        event: '*', 
        table: 'bookings', 
        schema: 'public' 
      }, () => fetchBookings())
      .subscribe()
      
    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchBookings])

  useEffect(() => { 
    fetchBookings() 
  }, [fetchBookings])

  return {
    bookings, total, totalPages, search, setSearch,
    statusFilter, setStatusFilter, typeFilter, setTypeFilter,
    currentPage, setCurrentPage, loading, error,
    updateBookingStatus, exportCSV, refresh: fetchBookings,
  }
}