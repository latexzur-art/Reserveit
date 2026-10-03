'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { AuditLog } from '@/backend/admin/admin.types'

export const useAdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [totalLogs, setTotalLogs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [actionFilter, setActionFilter] = useState<string>('all')
  const abortRef = useRef<AbortController | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize))

  const fetchLogs = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)

    try {
      const params = new URLSearchParams()
      params.set('page', String(currentPage))
      params.set('pageSize', String(pageSize))
      if (actionFilter !== 'all') params.set('action', actionFilter)

      const res = await fetch(`/api/admin/audit-logs?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('Failed to fetch audit logs')
      const data = await res.json()
      setLogs(data.logs || [])
      setTotalLogs(data.total || 0)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to fetch audit logs:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, actionFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    setCurrentPage(1)
  }, [actionFilter])

  return {
    logs,
    totalLogs,
    loading,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    actionFilter,
    setActionFilter,
    refreshLogs: fetchLogs,
  }
}
