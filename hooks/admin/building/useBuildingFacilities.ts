'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { BuildingFacility, BuildingFloor } from '@/backend/admin/building/building.types'
import { useToast } from '@/hooks/use-toast'

export const useBuildingFacilities = () => {
  const [facilities, setFacilities] = useState<BuildingFacility[]>([])
  const [total, setTotal] = useState(0)
  const [floors, setFloors] = useState<BuildingFloor[]>([])
  const [facilityTypes, setFacilityTypes] = useState<{ id: string; name: string }[]>([])
  const [search, setSearch] = useState('')
  const [floorFilter, setFloorFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(200)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const abortRef = useRef<AbortController | null>(null)
  const initialLoadDone = useRef(false)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchFacilities = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (!initialLoadDone.current) setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (floorFilter) params.set('floor', floorFilter)
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(currentPage))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/building/facilities?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('Failed to fetch facilities')
      const data = await res.json()
      setFacilities(data.facilities || [])
      setTotal(data.total || 0)
      initialLoadDone.current = true
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [search, floorFilter, typeFilter, statusFilter, currentPage, pageSize])

  const fetchFloors = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/building/facilities/floors')
      if (res.ok) {
        const data = await res.json()
        setFloors(data.floors || [])
      }
    } catch { /* silent */ }
  }, [])

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/building/facilities/types')
      if (res.ok) {
        const data = await res.json()
        setFacilityTypes(data.types || [])
      }
    } catch { /* silent */ }
  }, [])

  const createFacility = useCallback(async (facility: Record<string, any>) => {
    try {
      const res = await fetch('/api/admin/building/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(facility),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create facility')
      }
      toast({ title: 'Facility created successfully' })
      fetchFacilities()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchFacilities, toast])

  const updateFacility = useCallback(async (id: string, updates: Record<string, any>) => {
    try {
      const res = await fetch(`/api/admin/building/facilities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update facility')
      }
      toast({ title: 'Facility updated successfully' })
      fetchFacilities()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchFacilities, toast])

  const deleteFacility = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/building/facilities/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete facility')
      }
      toast({ title: 'Facility removed successfully' })
      fetchFacilities()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchFacilities, toast])

  useEffect(() => { fetchFacilities() }, [fetchFacilities])
  useEffect(() => { fetchFloors(); fetchTypes() }, [fetchFloors, fetchTypes])

  return {
    facilities, total, totalPages, floors, facilityTypes,
    search, setSearch, floorFilter, setFloorFilter,
    typeFilter, setTypeFilter, statusFilter, setStatusFilter,
    currentPage, setCurrentPage, loading, error,
    createFacility, updateFacility, deleteFacility,
    refresh: fetchFacilities,
  }
}

/**
 * Hook for facility status page with live occupancy
 */
export const useFacilityStatus = () => {
  const [facilities, setFacilities] = useState<BuildingFacility[]>([])
  const [floors, setFloors] = useState<BuildingFloor[]>([])
  const [floorFilter, setFloorFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (floorFilter) params.set('floor', floorFilter)

      const res = await fetch(`/api/admin/building/facilities/status?${params}`)
      if (!res.ok) throw new Error('Failed to fetch facility status')
      const data = await res.json()
      setFacilities(data.facilities || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [floorFilter])

  const fetchFloors = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/building/facilities/floors')
      if (res.ok) {
        const data = await res.json()
        setFloors(data.floors || [])
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])
  useEffect(() => { fetchFloors() }, [fetchFloors])

  // Poll every 30 seconds for live status
  useEffect(() => {
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Client-side search filter
  const filtered = search
    ? facilities.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        (f.roomNumber || '').toLowerCase().includes(search.toLowerCase())
      )
    : facilities

  const stats = {
    total: facilities.length,
    available: facilities.filter(f => f.status === 'available').length,
    occupied: facilities.filter(f => f.status === 'occupied' || f.currentActivity).length,
    maintenance: facilities.filter(f => f.status === 'maintenance').length,
  }

  return {
    facilities: filtered, floors, stats,
    search, setSearch, floorFilter, setFloorFilter,
    loading, error, refresh: fetchStatus,
  }
}
