"use client"

import { useState } from 'react'
import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { useFacultyNotifications } from '@/hooks/faculty/useFacultyNotifications'
import { NotificationCard } from '@/components/notifications/NotificationCard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, CheckCheck, Loader2, Inbox } from 'lucide-react'
import type { UnifiedNotification } from '@/types/notifications'
import { SkeletonList } from "@/components/ui/SkeletonList";


const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'booking', label: 'Bookings' },
  { value: 'schedule_upload', label: 'Schedules' },
  { value: 'payment', label: 'Payments' },
  { value: 'unread', label: 'Unread' },
]

function filterNotifications(notifications: UnifiedNotification[], tab: string): UnifiedNotification[] {
  if (tab === 'all') return notifications
  if (tab === 'unread') return notifications.filter(n => !n.read)
  return notifications.filter(n => n.sourceType === tab)
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useFacultyNotifications(50)
  const [activeTab, setActiveTab] = useState('all')

  const filtered = filterNotifications(notifications, activeTab)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <ConnectedTopBar title="Notifications" breadcrumbs={[{ label: 'Dashboard' }]} />

      <main className="container mx-auto px-4 sm:px-6 py-6 md:py-10 max-w-3xl">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Activity <span className="text-blue-600 dark:text-blue-400">Stream</span>
            </h2>
            {unreadCount > 0 ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                  {unreadCount} unread messages
                </p>
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Everything is up to date</p>
            )}
          </div>
          
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={markAllRead}
              className="w-full sm:w-auto font-bold uppercase tracking-wider text-xs h-9 border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-slate-900 shadow-sm"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Filter tabs - Scrollable on mobile */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              aria-pressed={activeTab === tab.value}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 border ${
                activeTab === tab.value
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-800'
              }`}
            >
              {tab.label}
              {tab.value === 'unread' && unreadCount > 0 && (
                <span className="ml-2 bg-white/20 text-white rounded-md px-1.5 py-0.5 text-xs font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400 relative" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Feed...</p>
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-16 text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 border-dashed border-2 rounded-2xl">
              <div className="bg-slate-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
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
                  className="mt-6 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-tighter"
                  onClick={() => setActiveTab('all')}
                >
                  View All Activity
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {filtered.map(n => (
                <div key={n.id} className="group relative">
                   {/* Unread Indicator Dot */}
                   {!n.read && (
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full z-10 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                   )}
                   <NotificationCard
                    notification={n}
                    onMarkRead={markRead}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Padding for fixed layouts */}
      <div className="h-20 md:hidden" />
    </div>
  )
}