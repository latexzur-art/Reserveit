'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

interface SystemLog {
  id: string
  actorId: string
  actorName: string
  actorEmail: string
  action: string
  targetType: string
  targetId: string
  details: any
  createdAt: string
}

export const useBuildingSystemLogs = () => {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ total: 0, today: 0 })
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const initialLoadDone = useRef(false)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchLogs = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (!initialLoadDone.current) setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (actionFilter) params.set('action', actionFilter)
      params.set('page', String(currentPage))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/building/logs/system?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('Failed to fetch system logs')
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
      initialLoadDone.current = true
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, actionFilter, currentPage, pageSize])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/building/logs/system/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])
  useEffect(() => { fetchStats() }, [fetchStats])

  return {
    logs, total, totalPages, stats,
    search, setSearch, actionFilter, setActionFilter,
    currentPage, setCurrentPage, loading, error,
    refresh: fetchLogs,
  }
}
