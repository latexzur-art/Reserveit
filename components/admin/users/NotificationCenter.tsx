'use client'

import { useState } from 'react'
import { Bell, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Notification } from '@/backend/admin/admin.types'
import { formatDistanceToNow } from 'date-fns'

interface NotificationCenterProps {
  notifications: Notification[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onClearAll: () => void
  viewAllHref?: string
}

const notificationIcons = {
  info: { icon: Info, className: 'text-blue-500 bg-blue-100 dark:bg-blue-950 dark:text-blue-400' },
  warning: { icon: AlertTriangle, className: 'text-amber-500 bg-amber-100 dark:bg-amber-950 dark:text-amber-400' },
  success: { icon: CheckCircle, className: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400' },
  error: { icon: XCircle, className: 'text-red-500 bg-red-100 dark:bg-red-950 dark:text-red-400' },
}

export const NotificationCenter = ({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  viewAllHref,
}: NotificationCenterProps) => {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground" aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onMarkAllRead} className="h-8 text-xs" aria-label="Mark all notifications as read">
              <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {!notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <Bell className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const { icon: Icon, className } = notificationIcons[notification.type]
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${!notification.read ? 'bg-primary/5' : ''}`}
                    onClick={() => !notification.read && onMarkRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className={`p-2 rounded-full ${className} flex-shrink-0`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!notification.read ? 'font-medium' : ''}`}>{notification.title}</p>
                          {!notification.read && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-2 border-t grid gap-2">
            {viewAllHref && (
              <Button variant="outline" size="sm" className="w-full" asChild onClick={() => setOpen(false)}>
                <Link href={viewAllHref}>View all notifications</Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-red-600 dark:hover:text-red-400" onClick={onClearAll}>
              <Trash2 className="h-4 w-4 mr-2" /> Clear all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
