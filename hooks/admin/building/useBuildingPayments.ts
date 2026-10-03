'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { BuildingTransaction } from '@/backend/admin/building/building.types'

export const useBuildingPayments = () => {
  const [transactions, setTransactions] = useState<BuildingTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [totalRefunded, setTotalRefunded] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const initialLoadDone = useRef(false)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchTransactions = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (!initialLoadDone.current) setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (methodFilter) params.set('method', methodFilter)
      params.set('page', String(currentPage))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/building/logs/payments?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('Failed to fetch payment logs')
      const data = await res.json()
      setTransactions(data.transactions || [])
      setTotal(data.total || 0)
      setTotalRefunded(data.totalRefunded || 0)
      initialLoadDone.current = true
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, methodFilter, currentPage, pageSize])

  const createPaymentLog = useCallback(async (payload: {
    bookingRef: string
    amount: number
    paymentMethod: string
    paymentStatus?: string
  }) => {
    try {
      const res = await fetch('/api/admin/building/logs/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to create payment log')
      await fetchTransactions()
      return true
    } catch (err: any) {
      setError(err.message)
      return false
    }
  }, [fetchTransactions])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  // Real-time: auto-refresh when payments table changes
  useEffect(() => {
    const supabase = createSupabaseClient()
    const channel = supabase.channel('payments-live')
      .on('postgres_changes', { event: '*', table: 'payments', schema: 'public' }, () => {
        fetchTransactions()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchTransactions])

  return {
    transactions, total, totalRefunded, totalPages,
    search, setSearch, statusFilter, setStatusFilter,
    methodFilter, setMethodFilter,
    currentPage, setCurrentPage, loading, error,
    refresh: fetchTransactions,
    createPaymentLog,
  }
}
