"use client"

import { useState, useEffect, useCallback } from 'react'
import { NotificationCard } from '@/components/notifications/NotificationCard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCheck, Loader2, Inbox } from 'lucide-react'
import { toUnifiedNotification, type UnifiedNotification } from '@/types/notifications'
import { SkeletonList } from "@/components/ui/SkeletonList";


const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'booking', label: 'Bookings' },
  { value: 'schedule_upload', label: 'Schedules' },
  { value: 'course_upload', label: 'Curriculum' },
  { value: 'unread', label: 'Unread' },
]

function filterNotifications(notifications: UnifiedNotification[], tab: string): UnifiedNotification[] {
  if (tab === 'all') return notifications
  if (tab === 'unread') return notifications.filter(n => !n.read)
  return notifications.filter(n => n.sourceType === tab)
}

export default function AcademicNotificationsPage() {
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/academic-head/notifications?limit=50')
      if (res.ok) {
        const data = await res.json()
        setNotifications((data.notifications ?? []).map(toUnifiedNotification))
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try {
      await fetch('/api/academic-head/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', id }),
      })
    } catch { /* ignore */ }
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await fetch('/api/academic-head/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
    } catch { /* ignore */ }
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length
  const filtered = filterNotifications(notifications, activeTab)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <main className="container mx-auto px-4 sm:px-6 py-6 md:py-10 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
              Activity <span className="text-accent-brand">Stream</span>
            </h1>
            {unreadCount > 0 ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {unreadCount} unread message{unreadCount > 1 ? 's' : ''}
                </p>
              </div>
            ) : (
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
                Everything is up to date
              </p>
            )}
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              className="w-full sm:w-auto font-bold uppercase tracking-wider text-xs h-9 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 border ${
                activeTab === tab.value
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-700'
              }`}
            >
              {tab.label}
              {tab.value === 'unread' && unreadCount > 0 && (
                <span className={`ml-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                  activeTab === 'unread'
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-slate-400/20 blur-xl rounded-full" />
                <Loader2 className="w-10 h-10 animate-spin text-slate-700 dark:text-slate-300 relative" />
              </div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Loading Feed...
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-16 text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 border-dashed border-2 rounded-2xl">
              <div className="bg-slate-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-2">
                {activeTab === 'unread' ? 'Zero Inbox' : 'No Notifications'}
              </h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                {activeTab === 'unread'
                  ? 'Great job! You have cleared all your unread notifications.'
                  : 'We couldn’t find any notifications in this category yet.'}
              </p>
              {activeTab !== 'all' && (
                <Button
                  variant="ghost"
                  className="mt-6 text-slate-800 dark:text-slate-200 font-bold uppercase tracking-wider text-xs"
                  onClick={() => setActiveTab('all')}
                >
                  View All Activity
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {filtered.map(n => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  onMarkRead={markRead}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <div className="h-20 md:hidden" />

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
