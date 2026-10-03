'use client'

import { useState, useCallback, useEffect } from 'react'
import { toUnifiedNotification, type UnifiedNotification } from '@/types/notifications'

export const useAdminNotifications = () => {
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications')
      if (res.ok) {
        const data = await res.json()
        const rows = data.notifications ?? []
        setNotifications(rows.map((row: Record<string, unknown>) => toUnifiedNotification(row)))
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const unreadCount = notifications.filter(n => !n.read).length

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try {
      await fetch(`/api/admin/notifications/${id}`, { method: 'PATCH' })
    } catch {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: false } : n))
    }
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    const prev = notifications
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await fetch('/api/admin/notifications/read-all', { method: 'POST' })
    } catch {
      setNotifications(prev)
    }
  }, [notifications])

  const clearAllNotifications = useCallback(async () => {
    try {
      await fetch('/api/admin/notifications', { method: 'DELETE' })
    } catch {
      // ignore
    }
    setNotifications([])
  }, [])

  return {
    notifications,
    unreadCount,
    loading,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
    refreshNotifications: fetchNotifications,
  }
}
