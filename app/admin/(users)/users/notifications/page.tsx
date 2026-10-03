'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Bell, RefreshCw, AlertCircle, BellOff, CheckCircle2,
  Info, AlertTriangle, CheckCircle, XCircle, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import type { NotificationRow } from '@/backend/notifications/notification.types'

const typeConfig: Record<string, { icon: typeof Info; bg: string; text: string; dot: string }> = {
  info:    { icon: Info,         bg: 'bg-blue-500/10',    text: 'text-blue-500',    dot: 'bg-blue-500' },
  success: { icon: CheckCircle,  bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-500' },
  warning: { icon: AlertTriangle,bg: 'bg-amber-500/10',   text: 'text-amber-500',   dot: 'bg-amber-500' },
  error:   { icon: XCircle,      bg: 'bg-red-500/10',     text: 'text-red-500',     dot: 'bg-red-500' },
}

export default function ITAdminNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNotif, setSelectedNotif] = useState<NotificationRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/notifications?limit=50')
      if (!res.ok) throw new Error('Failed to fetch notifications')
      const data = await res.json()
      setNotifications(data.notifications ?? [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = async () => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (err) {
      console.error('[Notifications] markAllRead failed:', err)
    }
  }

  const viewNotification = async (notif: NotificationRow) => {
    setSelectedNotif(notif)
    setDetailOpen(true)
    if (!notif.read) {
      try {
        await fetch(`/api/admin/notifications/${notif.id}`, { method: 'PATCH' })
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
      } catch (err) {
        console.error('[Notifications] markRead failed:', err)
      }
    }
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return formatDistanceToNow(d, { addSuffix: true })
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400 mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400">{error}</p>
        <Button variant="link" onClick={fetchNotifications}>Retry Fetch</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">
            System <span className="text-accent-brand">Notifications</span>
          </h1>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchNotifications}
            className="h-9 w-9 rounded-lg border border-border"
            title="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4 text-muted-foreground', loading && 'animate-spin')} />
          </Button>
          <Button
            variant="outline"
            className="rounded-lg text-xs font-semibold border-border hover:bg-muted h-9 px-3.5"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-500" /> Mark All Read
          </Button>
        </div>
      </div>

      {/* Notification List */}
      <Card className="rounded-xl overflow-hidden border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
              <BellOff className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">Everything is up to date</p>
            <p className="text-xs text-muted-foreground mt-1">No notifications to display</p>
          </div>
        ) : (
          <ScrollArea className="h-[65vh]">
            <div className="divide-y divide-border/40">
              {notifications.map(notif => {
                const cfg = typeConfig[notif.type] ?? typeConfig.info
                const Icon = cfg.icon
                return (
                  <div
                    key={notif.id}
                    onClick={() => viewNotification(notif)}
                    className={cn(
                      'p-4 sm:p-5 cursor-pointer transition-all hover:bg-muted/40 flex items-start gap-4 relative group',
                      !notif.read && 'bg-primary/[0.03]'
                    )}
                  >
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs mt-0.5', cfg.bg)}>
                      <Icon className={cn('w-5 h-5', cfg.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1 gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{notif.title}</p>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-xs text-muted-foreground font-medium">
                            {formatTime(notif.created_at)}
                          </span>
                          {!notif.read && (
                            <span className={cn('w-2 h-2 rounded-full', cfg.dot)} title="Unread" />
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </Card>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-card border-border p-6 shadow-xl">
          {selectedNotif && (() => {
            const cfg = typeConfig[selectedNotif.type] ?? typeConfig.info
            const Icon = cfg.icon
            return (
              <div className="space-y-5">
                <DialogHeader>
                  <div className="flex items-center gap-4">
                    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
                      <Icon className={cn('w-5 h-5', cfg.text)} />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold text-foreground leading-snug">
                        {selectedNotif.title}
                      </DialogTitle>
                      <p className="text-xs font-medium text-muted-foreground mt-0.5">
                        {formatTime(selectedNotif.created_at)}
                      </p>
                    </div>
                  </div>
                </DialogHeader>

                <div className="p-4 rounded-xl bg-muted/30 text-xs font-normal leading-relaxed text-foreground border border-border/50">
                  {selectedNotif.message}
                </div>

                {selectedNotif.priority && selectedNotif.priority !== 'normal' && (
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Priority</span>
                    <span className={cn(
                      'font-semibold capitalize',
                      selectedNotif.priority === 'urgent' ? 'text-red-500' :
                      selectedNotif.priority === 'high' ? 'text-amber-500' : 'text-foreground'
                    )}>
                      {selectedNotif.priority}
                    </span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => setDetailOpen(false)}
                    className="rounded-xl text-xs font-semibold px-6 h-9"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
