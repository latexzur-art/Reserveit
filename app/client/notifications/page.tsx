"use client"

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ConnectedClientTopBar } from '../_components/ConnectedClientTopBar'
import { useNotifications } from '@/hooks/notifications/useNotifications'
import { NotificationCard } from '@/components/notifications/NotificationCard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, CheckCheck, Inbox, Sparkles } from 'lucide-react'
import type { UnifiedNotification } from '@/types/notifications'
import { cn } from "@/lib/utils"
import { ROUTES } from '@/lib/routes'
import { SkeletonList } from "@/components/ui/SkeletonList"

const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'booking', label: 'Bookings' },
  { value: 'payment', label: 'Payments' },
  { value: 'unread', label: 'Unread' },
]

function filterNotifications(notifications: UnifiedNotification[], tab: string): UnifiedNotification[] {
  if (tab === 'all') return notifications
  if (tab === 'unread') return notifications.filter(n => !n.read)
  return notifications.filter(n => n.sourceType === tab)
}

export default function ClientNotificationsPage() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications(50)
  const [activeTab, setActiveTab] = useState('all')

  const filtered = useMemo(
    () => filterNotifications(notifications, activeTab),
    [notifications, activeTab]
  )

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <ConnectedClientTopBar title="Notifications" breadcrumbs={[{ label: 'Dashboard', href: ROUTES.client.dashboard }]} />

      <main className="p-4 sm:p-8 max-w-4xl mx-auto pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Notifications <span className="text-yellow-600 dark:text-yellow-400">Center</span>
            </h1>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              Updates and alerts regarding your bookings and payments
            </p>
          </div>

          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllRead}
                className="rounded-xl h-9 px-3.5 border-border/80 text-xs font-semibold hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                Mark All Read
              </Button>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border/80 shadow-xs">
              <div className={cn("w-2 h-2 rounded-full bg-blue-500", unreadCount > 0 && "animate-pulse")} />
              <span className="text-xs font-semibold text-foreground">
                {unreadCount} Unread
              </span>
            </div>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div role="tablist" aria-label="Notification filters" className="flex items-center gap-1 p-1 bg-muted/40 border border-border/60 rounded-xl">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeTab === tab.value
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                {tab.value === 'unread' && unreadCount > 0 && (
                  <span className="flex h-4 min-w-4 px-1 items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="space-y-4">
          {loading ? (
            <SkeletonList />
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center border-border/80 rounded-2xl shadow-xs relative overflow-hidden group">
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 bg-muted/40 rounded-xl flex items-center justify-center mb-4 border border-border/50">
                  {activeTab === 'unread' ? (
                    <Sparkles className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <Bell className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {activeTab === 'unread' ? 'All Caught Up' : 'No Notifications Yet'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {activeTab === 'unread' ? 'You have no unread notifications' : "You'll see updates about your facility bookings and payments here."}
                </p>
                {activeTab !== 'unread' && (
                  <Link
                    href={ROUTES.client.booking}
                    className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all shadow-xs"
                  >
                    Make a Booking
                  </Link>
                )}
              </div>
            </Card>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
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