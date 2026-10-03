'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { BuildingEquipment } from '@/backend/admin/building/building.types'
import { useToast } from '@/hooks/use-toast'
import { filterEquipmentGroups } from './equipmentFilters'

export const useBuildingEquipment = (basePath: string = '/api/admin/building/equipment') => {
  // The full grouped set, fetched once. Filtering and pagination are derived
  // from this in memory (see below) so changing a filter never hits the network.
  const [allGroups, setAllGroups] = useState<BuildingEquipment[]>([])
  const [equipmentTypes, setEquipmentTypes] = useState<{ id: string; name: string }[]>([])
  const [statusTypes, setStatusTypes] = useState<{ id: string; name: string }[]>([])
  const [stats, setStats] = useState({ total: 0, available: 0, inUse: 0, maintenance: 0 })
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState('')
  // Ownership scope: '' / 'all' = every managed_by, or 'pamo' | 'it' | 'building'.
  const [scopeFilter, setScopeFilter] = useState('')
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const abortRef = useRef<AbortController | null>(null)
  const initialLoadDone = useRef(false)

  // Fetch the entire grouped set once. The service already loads and groups the
  // full active inventory on every request (no DB-level pagination), so pulling
  // it all in one shot and filtering client-side removes a network round-trip
  // per keystroke / filter click without adding real server cost.
  const fetchEquipment = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (!initialLoadDone.current) setLoading(true)
    setError(null)

    try {
      // No filter params: we want every group. A large pageSize returns them all
      // (the service slices groups by pageSize) without an API change.
      const params = new URLSearchParams({ page: '1', pageSize: '100000' })
      const res = await fetch(`${basePath}?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('Failed to fetch equipment')
      const data = await res.json()
      setAllGroups(data.equipment || [])
      initialLoadDone.current = true
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [basePath])

  // Client-side filtering + pagination. Instant, and identical in meaning to the
  // filters the server used to apply (kept in equipmentFilters for testability).
  const filteredGroups = useMemo(
    () => filterEquipmentGroups(allGroups, {
      search,
      category: categoryFilter,
      status: statusFilter,
      scope: scopeFilter,
      assignment: assignmentFilter,
    }),
    [allGroups, search, categoryFilter, statusFilter, scopeFilter, assignmentFilter],
  )

  const total = filteredGroups.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const equipment = useMemo(() => {
    // Clamp the page so a filter that shrinks the result set never lands the
    // slice out of range before the reset effect below runs.
    const page = Math.min(currentPage, totalPages)
    const start = (page - 1) * pageSize
    return filteredGroups.slice(start, start + pageSize)
  }, [filteredGroups, currentPage, totalPages, pageSize])

  // Any filter change returns the user to page 1.
  useEffect(() => {
    setCurrentPage(1)
  }, [search, categoryFilter, statusFilter, scopeFilter, assignmentFilter])

  const fetchMeta = useCallback(async () => {
    try {
      const [typesRes, statsRes, facilitiesRes] = await Promise.all([
        fetch(`${basePath}/types`),
        fetch(`${basePath}/stats`),
        // Facility list for the assign picker. Only meaningful for the building
        // scope; other scopes 404 harmlessly and leave facilities empty.
        fetch('/api/admin/building/facilities?pageSize=200'),
      ])
      if (typesRes.ok) {
        const data = await typesRes.json()
        setEquipmentTypes(data.types || [])
        setStatusTypes(data.statusTypes || [])
      }
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
      if (facilitiesRes.ok) {
        const data = await facilitiesRes.json()
        setFacilities(data.facilities || [])
      }
    } catch { /* silent */ }
  }, [basePath])

  /** Directly move non-tech (PAMO) equipment to a facility (or Storage when null). */
  const assignEquipment = useCallback(async (ids: string[], toFacilityId: string | null, reason: string) => {
    try {
      const results = await Promise.all(
        ids.map(id =>
          fetch(`${basePath}/${id}/assign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toFacilityId, reason }),
          }),
        ),
      )
      const failed = results.find(r => !r.ok)
      if (failed) {
        const data = await failed.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to assign equipment')
      }
      toast({ title: ids.length > 1 ? `Assigned ${ids.length} units` : 'Equipment assigned' })
      fetchEquipment()
      fetchMeta()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchEquipment, fetchMeta, toast, basePath])

  /** Request a tech (IT) move — creates an assignment request IT Admin approves. */
  const requestAssignEquipment = useCallback(async (ids: string[], toFacilityId: string, reason: string) => {
    try {
      const results = await Promise.all(
        ids.map(id =>
          fetch('/api/equipment-assignment-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ equipmentId: id, toFacilityId, reason }),
          }),
        ),
      )
      const failed = results.find(r => !r.ok)
      if (failed) {
        const data = await failed.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit assignment request')
      }
      toast({ title: ids.length > 1 ? `Requested ${ids.length} assignments` : 'Assignment request submitted' })
      fetchEquipment()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchEquipment, toast])

  const createEquipment = useCallback(async (item: Record<string, any>) => {
    try {
      const res = await fetch(basePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create equipment')
      }
      toast({ title: 'Equipment added successfully' })
      fetchEquipment()
      fetchMeta()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchEquipment, fetchMeta, toast, basePath])

  const updateEquipment = useCallback(async (id: string, updates: Record<string, any>) => {
    try {
      const res = await fetch(`${basePath}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update equipment')
      }
      toast({ title: 'Equipment updated successfully' })
      fetchEquipment()
      fetchMeta()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchEquipment, fetchMeta, toast, basePath])

  const deleteEquipment = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${basePath}/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete equipment')
      }
      toast({ title: 'Equipment removed successfully' })
      fetchEquipment()
      fetchMeta()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchEquipment, fetchMeta, toast, basePath])

  const deleteBulkEquipment = useCallback(async (ids?: string[], filters?: any) => {
    try {
      const res = await fetch(`${basePath}/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, filters }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete selected equipment')
      }
      toast({ title: filters ? 'Successfully removed all filtered items' : `Successfully removed ${ids?.length} items` })
      fetchEquipment()
      fetchMeta()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchEquipment, fetchMeta, toast, basePath])

  const updateBulkEquipment = useCallback(async (updates: Record<string, any>, ids?: string[], filters?: any) => {
    try {
      const res = await fetch(`${basePath}/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, updates, filters }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update selected equipment')
      }
      toast({ title: filters ? 'Successfully updated all filtered items' : `Successfully updated ${ids?.length} items` })
      fetchEquipment()
      fetchMeta()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchEquipment, fetchMeta, toast, basePath])

  useEffect(() => { fetchEquipment() }, [fetchEquipment])
  useEffect(() => { fetchMeta() }, [fetchMeta])

  return {
    equipment, total, totalPages, equipmentTypes, statusTypes, stats, facilities,
    search, setSearch, categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter, assignmentFilter, setAssignmentFilter,
    scopeFilter, setScopeFilter,
    currentPage, setCurrentPage, loading, error,
    createEquipment, updateEquipment, deleteEquipment,
    deleteBulkEquipment, updateBulkEquipment,
    assignEquipment, requestAssignEquipment,
    refresh: fetchEquipment,
  }
}
