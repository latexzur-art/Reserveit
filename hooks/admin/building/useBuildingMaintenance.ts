'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { BuildingMaintenance } from '@/backend/admin/building/building.types'
import { useToast } from '@/hooks/use-toast'

export const useBuildingMaintenance = () => {
  const [records, setRecords] = useState<BuildingMaintenance[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ total: 0, scheduled: 0, inProgress: 0, completed: 0 })
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const abortRef = useRef<AbortController | null>(null)
  const initialLoadDone = useRef(false)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchRecords = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (!initialLoadDone.current) setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(currentPage))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/building/maintenance?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('Failed to fetch maintenance records')
      const data = await res.json()
      setRecords(data.records || [])
      setTotal(data.total || 0)
      initialLoadDone.current = true
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, statusFilter, currentPage, pageSize])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/building/maintenance/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch { /* silent */ }
  }, [])

  const createRecord = useCallback(async (record: Record<string, any>) => {
    try {
      const res = await fetch('/api/admin/building/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create maintenance record')
      }
      toast({ title: 'Maintenance record created' })
      fetchRecords()
      fetchStats()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchRecords, fetchStats, toast])

  const updateRecord = useCallback(async (id: string, updates: Record<string, any>) => {
    try {
      const res = await fetch(`/api/admin/building/maintenance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update maintenance record')
      }
      toast({ title: 'Maintenance record updated' })
      fetchRecords()
      fetchStats()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchRecords, fetchStats, toast])

  const deleteRecord = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/building/maintenance/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete maintenance record')
      }
      toast({ title: 'Maintenance record deleted' })
      fetchRecords()
      fetchStats()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [fetchRecords, fetchStats, toast])

  useEffect(() => { fetchRecords() }, [fetchRecords])
  useEffect(() => { fetchStats() }, [fetchStats])

  return {
    records, total, totalPages, stats,
    search, setSearch, typeFilter, setTypeFilter,
    statusFilter, setStatusFilter,
    currentPage, setCurrentPage, loading, error,
    createRecord, updateRecord, deleteRecord,
    refresh: fetchRecords,
  }
}
