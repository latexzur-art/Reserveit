'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import type {
  DirectoryPerson,
  DirectoryPersonDetail,
  DirectoryBooking,
  DirectoryPayment,
  DirectorySchedule,
  FacilityAssignmentSummary,
  MaintenanceStaffMember,
  PersonCategory,
} from '@/backend/admin/building/building.types'

// ─── Directory list ───────────────────────────────────────────────────────────

export interface DirectoryListState {
  items: DirectoryPerson[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  error: string | null
  search: string
  setSearch: (v: string) => void
  category: PersonCategory | 'all'
  setCategory: (v: PersonCategory | 'all') => void
  departmentId: string
  setDepartmentId: (v: string) => void
  status: 'active' | 'inactive' | 'all'
  setStatus: (v: 'active' | 'inactive' | 'all') => void
  sortBy: string
  setSortBy: (v: string) => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (v: 'asc' | 'desc') => void
  setPage: (v: number) => void
  totalPages: number
  refresh: () => void
}

export function useBuildingDirectory(): DirectoryListState {
  const [items, setItems] = useState<DirectoryPerson[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearchRaw] = useState('')
  const [category, setCategory] = useState<PersonCategory | 'all'>('all')
  const [departmentId, setDepartmentId] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const abortRef = useRef<AbortController | null>(null)
  const initialLoadDone = useRef(false)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const setSearch = useCallback((v: string) => {
    setSearchRaw(v)
    setPage(1)
  }, [])

  const fetchItems = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (!initialLoadDone.current) setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (category !== 'all') params.set('category', category)
      if (departmentId) params.set('departmentId', departmentId)
      if (status !== 'all') params.set('status', status)
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/building/directory?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('Failed to fetch directory')
      const data = await res.json()
      setItems(data.items || [])
      setTotal(data.total || 0)
      initialLoadDone.current = true
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, category, departmentId, status, sortBy, sortOrder, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  return {
    items, total, page, pageSize, loading, error,
    search, setSearch,
    category, setCategory,
    departmentId, setDepartmentId,
    status, setStatus,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    setPage,
    totalPages,
    refresh: fetchItems,
  }
}

// ─── Person detail (lazy per-tab) ─────────────────────────────────────────────

export function usePersonDetail(id: string | null, source: 'users' | 'maintenance_staff' | null) {
  const [detail, setDetail] = useState<DirectoryPersonDetail | null>(null)
  const [bookings, setBookings] = useState<DirectoryBooking[]>([])
  const [payments, setPayments] = useState<DirectoryPayment[]>([])
  const [schedules, setSchedules] = useState<DirectorySchedule[]>([])
  const [assignments, setAssignments] = useState<FacilityAssignmentSummary[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingBookings, setLoadingBookings] = useState(false)
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [loadingAssignments, setLoadingAssignments] = useState(false)

  const fetchDetail = useCallback(async () => {
    if (!id || !source) return
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/admin/building/directory/${id}?source=${source}`)
      if (!res.ok) throw new Error('Failed to fetch detail')
      setDetail(await res.json())
    } finally {
      setLoadingDetail(false)
    }
  }, [id, source])

  const fetchBookings = useCallback(async () => {
    if (!id || source !== 'users') return
    setLoadingBookings(true)
    try {
      const res = await fetch(`/api/admin/building/directory/${id}/bookings`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setBookings(data.bookings || [])
    } finally {
      setLoadingBookings(false)
    }
  }, [id, source])

  const fetchPayments = useCallback(async () => {
    if (!id || source !== 'users') return
    setLoadingPayments(true)
    try {
      const res = await fetch(`/api/admin/building/directory/${id}/payments`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setPayments(data.payments || [])
    } finally {
      setLoadingPayments(false)
    }
  }, [id, source])

  const fetchSchedules = useCallback(async () => {
    if (!id || source !== 'users') return
    setLoadingSchedules(true)
    try {
      const res = await fetch(`/api/admin/building/directory/${id}/schedules`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setSchedules(data.schedules || [])
    } finally {
      setLoadingSchedules(false)
    }
  }, [id, source])

  const fetchAssignments = useCallback(async () => {
    if (!id || source !== 'maintenance_staff') return
    setLoadingAssignments(true)
    try {
      const res = await fetch(`/api/admin/building/directory/${id}/assignments`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setAssignments(data.assignments || [])
    } finally {
      setLoadingAssignments(false)
    }
  }, [id, source])

  useEffect(() => {
    if (!id || !source) {
      setDetail(null)
      setBookings([])
      setPayments([])
      setSchedules([])
      setAssignments([])
      return
    }
    fetchDetail()
    if (source === 'users') {
      fetchBookings()
      fetchPayments()
      fetchSchedules()
    }
    if (source === 'maintenance_staff') {
      fetchAssignments()
    }
  }, [id, source])

  return {
    detail, bookings, payments, schedules, assignments,
    loadingDetail, loadingBookings, loadingPayments, loadingSchedules, loadingAssignments,
    refreshAssignments: fetchAssignments,
    refreshDetail: fetchDetail,
  }
}

// ─── Maintenance staff mutations ──────────────────────────────────────────────

export function useMaintenanceStaffMutations() {
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [unassigning, setUnassigning] = useState(false)
  const [reassigning, setReassigning] = useState(false)
  const { toast } = useToast()

  const create = useCallback(async (data: {
    fullName: string
    email?: string
    phone?: string
    position?: string
    specialization?: string
    hireDate?: string
    notes?: string
  }): Promise<MaintenanceStaffMember | null> => {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/building/directory/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to create')
      toast({ title: 'Staff member added', description: `ID: ${result.employeeId}` })
      return result as MaintenanceStaffMember
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return null
    } finally {
      setCreating(false)
    }
  }, [toast])

  const update = useCallback(async (id: string, data: Partial<{
    fullName: string
    email: string
    phone: string
    position: string
    specialization: string
    hireDate: string
    notes: string
  }>): Promise<MaintenanceStaffMember | null> => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/building/directory/maintenance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to update')
      toast({ title: 'Staff member updated' })
      return result as MaintenanceStaffMember
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return null
    } finally {
      setUpdating(false)
    }
  }, [toast])

  const deactivate = useCallback(async (id: string): Promise<boolean> => {
    setDeactivating(true)
    try {
      const res = await fetch(`/api/admin/building/directory/maintenance/${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Staff member deactivated' })
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setDeactivating(false)
    }
  }, [toast])

  const assignFacilities = useCallback(async (staffId: string, facilityIds: string[]): Promise<boolean> => {
    setAssigning(true)
    try {
      const res = await fetch(`/api/admin/building/directory/maintenance/${staffId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityIds }),
      })
      const result = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          toast({ title: 'Already assigned', description: 'One or more facilities are already assigned', variant: 'destructive' })
        } else {
          throw new Error(result.error || 'Failed')
        }
        return false
      }
      toast({ title: 'Assigned successfully' })
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setAssigning(false)
    }
  }, [toast])

  const unassign = useCallback(async (assignmentId: string): Promise<boolean> => {
    setUnassigning(true)
    try {
      const res = await fetch(`/api/admin/building/directory/maintenance/assignments/${assignmentId}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Unassigned successfully' })
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setUnassigning(false)
    }
  }, [toast])

  const reassign = useCallback(async (staffId: string, fromFacilityId: string, toFacilityId: string): Promise<boolean> => {
    setReassigning(true)
    try {
      const res = await fetch(`/api/admin/building/directory/maintenance/${staffId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromFacilityId, toFacilityId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Reassigned successfully' })
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setReassigning(false)
    }
  }, [toast])

  return { create, update, deactivate, assignFacilities, unassign, reassign, creating, updating, deactivating, assigning, unassigning, reassigning }
}
