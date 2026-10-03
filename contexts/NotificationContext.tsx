'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import useSWR from 'swr'
import type { UnifiedNotification } from '@/types/notifications'
import { toUnifiedNotification } from '@/types/notifications'
import { useToast } from '@/hooks/use-toast'

interface NotificationContextValue {
  notifications: UnifiedNotification[]
  unreadCount: number
  loading: boolean
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  deleteAll: () => Promise<void>
  refresh: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

interface NotificationProviderProps {
  apiEndpoint: string
  markReadEndpoint?: string
  children: React.ReactNode
}

export function NotificationProvider({
  apiEndpoint,
  markReadEndpoint,
  children,
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const prevUnreadCountRef = useRef(0)
  const { toast } = useToast()

  const { data, isLoading, mutate } = useSWR<any>(
    `${apiEndpoint}?limit=30`,
    (url: string) => fetch(url).then((res) => res.json()),
    { refreshInterval: 30_000, revalidateOnFocus: true }
  )

  useEffect(() => {
    if (!data) return
    const items = (data.notifications ?? []).map(toUnifiedNotification)
    const newUnreadCount = data.unread_count ?? 0

    if (
      prevUnreadCountRef.current > 0 &&
      newUnreadCount > prevUnreadCountRef.current
    ) {
      const newCount = newUnreadCount - prevUnreadCountRef.current
      const newest = items.filter((n: UnifiedNotification) => !n.read).slice(0, Math.min(newCount, 3))
      newest.forEach((n: UnifiedNotification) => {
        toast({ title: n.title, description: n.message })
      })
    }

    prevUnreadCountRef.current = newUnreadCount
    setNotifications(items)
    setUnreadCount(newUnreadCount)
  }, [data, toast])

  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  const markRead = useCallback(
    async (id: string) => {
      const endpoint = markReadEndpoint
        ? `${markReadEndpoint}/${id}`
        : `${apiEndpoint}/${id}/read`

      await fetch(endpoint, { method: 'PATCH' })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
      prevUnreadCountRef.current = Math.max(0, prevUnreadCountRef.current - 1)
    },
    [apiEndpoint, markReadEndpoint]
  )

  const markAllRead = useCallback(async () => {
    if (apiEndpoint.includes('/admin/')) {
      await fetch(apiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
    } else {
      await fetch(`${apiEndpoint}/read-all`, { method: 'PATCH' })
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    prevUnreadCountRef.current = 0
  }, [apiEndpoint])

  const deleteNotification = useCallback(
    async (id: string) => {
      const wasUnread = notifications.find((n) => n.id === id && !n.read)

      if (apiEndpoint.includes('/admin/')) {
        await fetch(`${apiEndpoint}/${id}`, { method: 'DELETE' })
      } else {
        await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      }

      setNotifications((prev) => prev.filter((n) => n.id !== id))
      if (wasUnread) {
        setUnreadCount((c) => Math.max(0, c - 1))
        prevUnreadCountRef.current = Math.max(0, prevUnreadCountRef.current - 1)
      }
    },
    [apiEndpoint, notifications]
  )

  const deleteAll = useCallback(async () => {
    await fetch(apiEndpoint, { method: 'DELETE' })
    setNotifications([])
    setUnreadCount(0)
    prevUnreadCountRef.current = 0
  }, [apiEndpoint])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading: isLoading,
        markRead,
        markAllRead,
        deleteNotification,
        deleteAll,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return ctx
}
