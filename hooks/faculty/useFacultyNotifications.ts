'use client'

import { useState, useCallback, useEffect } from 'react'
import { toUnifiedNotification, type UnifiedNotification } from '@/types/notifications'

export function useFacultyNotifications(limit = 20) {
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?limit=${limit}`)
      if (!res.ok) return
      const data = await res.json()
      const mapped = (data.notifications ?? []).map((row: Record<string, unknown>) => toUnifiedNotification(row))
      setNotifications(mapped)
      setUnreadCount(data.unread_count ?? mapped.filter((n: UnifiedNotification) => !n.read).length)
    } catch {
      // silently fail — notifications are non-critical
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      if (!res.ok) throw new Error()
    } catch {
      fetchNotifications()
    }
  }, [fetchNotifications])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'PATCH' })
      if (!res.ok) throw new Error()
    } catch {
      fetchNotifications()
    }
  }, [fetchNotifications])

  const clearAll = useCallback(async () => {
    try {
      await fetch('/api/notifications', { method: 'DELETE' })
    } catch {
      // ignore
    }
    setNotifications([])
    setUnreadCount(0)
  }, [])

  return {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    clearAll,
    refresh: fetchNotifications,
  }
}
