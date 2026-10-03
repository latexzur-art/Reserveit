"use client"

import { useState } from 'react'
import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { useNotifications } from '@/hooks/notifications/useNotifications'
import { NotificationCard } from '@/components/notifications/NotificationCard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, CheckCheck, Loader2, Inbox, Filter } from 'lucide-react'
import type { UnifiedNotification } from '@/types/notifications'
import { cn } from "@/lib/utils"
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
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications(50)
  const [activeTab, setActiveTab] = useState('all')

  const filtered = filterNotifications(notifications, activeTab)

  return (
    <div className="space-y-6 p-4 sm:p-8 lg:p-12">
      <div className="sticky top-0 z-40 -mx-4 sm:-mx-8 lg:-mx-12 -mt-4 sm:-mt-8 lg:-mt-12 mb-8">
        <ConnectedTopBar title="Notifications" breadcrumbs={[{ label: 'Dashboard', href: '/program/dashboard' }]} />
      </div>

      <main className="max-w-3xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase text-foreground">
              Campus <span className="text-accent-brand">Alerts</span>
            </h1>
            <p className="dashboard-header-subtitle text-pico font-bold text-muted-foreground mt-1 uppercase tracking-[0.2em]">
              {unreadCount > 0 ? `${unreadCount} Unread Notifications` : 'Your Activity Feed is Clear'}
            </p>
          </div>
          
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={markAllRead}
              className="rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 font-black uppercase text-[10px] tracking-widest h-10 px-6 shadow-sm transition-all active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-2 text-blue-500" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Filter Tabs Section */}
        <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar bg-slate-100 dark:bg-white/5 p-1 rounded-2xl">
          <div className="flex gap-1 flex-nowrap w-full">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  activeTab === tab.value
                    ? "bg-card text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {tab.label}
                {tab.value === 'unread' && unreadCount > 0 && (
                  <span className="ml-2 rounded-full px-2 py-0.5 bg-blue-600 text-white text-[9px]">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="relative">
          {loading ? (
            <SkeletonList />
          ) : filtered.length === 0 ? (
            <div className="p-20 text-center bg-card border border-slate-200 dark:border-white/[0.06] rounded-3xl shadow-sm">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full" />
                <Inbox className="w-16 h-16 text-slate-200 dark:text-slate-800 relative" />
              </div>
              <p className="text-slate-400 dark:text-slate-600 font-black uppercase text-xs tracking-[0.2em]">
                {activeTab === 'unread' ? 'Zero Pending Notifications' : 'No Activity Found'}
              </p>
              <p className="text-[10px] text-slate-300 dark:text-slate-700 uppercase tracking-widest mt-2">
                We'll ping you when something happens
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(n => (
                <div key={n.id} className="transition-all hover:translate-x-1 duration-300">
                  <NotificationCard
                    notification={n}
                    onMarkRead={markRead}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Visual Footer */}
        <div className="mt-16 flex flex-col items-center space-y-4 pb-12">
           <div className="w-12 h-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent rounded-full" />
           <p className="text-[9px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.5em]">
              End of Stream
           </p>
        </div>
      </main>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}