'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCheck,
  Trash2,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  User,
  MapPin,
  Calendar,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { UnifiedNotification } from '@/types/notifications'
import { formatDistanceToNow } from 'date-fns'

interface NotificationBellProps {
  notifications: UnifiedNotification[]
  unreadCount: number
  viewAllHref: string
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onDeleteAll: () => void
}

const typeConfig = {
  info: {
    icon: Info,
    iconClass: 'text-blue-500 bg-blue-100 dark:bg-blue-950 dark:text-blue-400',
    borderClass: 'border-l-blue-400',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500 bg-amber-100 dark:bg-amber-950 dark:text-amber-400',
    borderClass: 'border-l-amber-400',
  },
  success: {
    icon: CheckCircle,
    iconClass: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400',
    borderClass: 'border-l-emerald-400',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-500 bg-red-100 dark:bg-red-950 dark:text-red-400',
    borderClass: 'border-l-red-400',
  },
} as const

const priorityDot: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-blue-400',
  low: 'bg-muted-foreground',
}

function MetaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
      <span className="text-muted-foreground w-16 flex-shrink-0">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

function NotificationCard({
  notification,
  onMarkRead,
  onNavigate,
}: {
  notification: UnifiedNotification
  onMarkRead: (id: string) => void
  onNavigate: (url: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = typeConfig[notification.type] ?? typeConfig.info
  const Icon = cfg.icon
  const meta = notification.metadata as Record<string, unknown> | undefined
  const hasDetails = !!meta && Object.keys(meta).length > 0

  const handleToggle = () => {
    if (!notification.read) onMarkRead(notification.id)
    if (hasDetails) setExpanded(e => !e)
  }

  const metaFields: { icon: React.ElementType; label: string; key: string }[] = [
    { icon: User,     label: 'By',         key: 'requester_name' },
    { icon: User,     label: 'Role',       key: 'requester_role' },
    { icon: MapPin,   label: 'Facility',   key: 'facility_name' },
    { icon: Calendar, label: 'Date',       key: 'booking_date' },
    { icon: Clock,    label: 'Duration',   key: 'duration' },
    { icon: Info,     label: 'Purpose',    key: 'purpose' },
    { icon: User,     label: 'Attendees',  key: 'expected_attendees' },
    { icon: User,     label: 'Decided by', key: 'decided_by_name' },
    { icon: Info,     label: 'Reason',     key: 'rejection_reason' },
    { icon: Info,     label: 'Notes',      key: 'revision_notes' },
    { icon: Info,     label: 'Department', key: 'department' },
    { icon: Info,     label: 'Term',       key: 'academic_term' },
  ]

  const visibleMeta = metaFields.filter(f => meta?.[f.key] && String(meta[f.key]).trim())

  return (
    <div
      className={`border-l-4 ${cfg.borderClass} ${!notification.read ? 'bg-primary/5' : ''} transition-colors`}
    >
      <div
        className="p-3 hover:bg-muted/40 cursor-pointer"
        onClick={handleToggle}
      >
        <div className="flex gap-2.5">
          <div className={`p-1.5 rounded-full ${cfg.iconClass} flex-shrink-0 self-start`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm leading-snug ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                {notification.title}
              </p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {notification.priority && notification.priority !== 'low' && (
                  <span className={`h-1.5 w-1.5 rounded-full ${priorityDot[notification.priority] ?? 'bg-muted'}`} />
                )}
                {!notification.read && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {notification.message}
            </p>
            {notification.actionUrl && (
              <div className="mt-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] gap-1 font-semibold px-2"
                  onClick={e => {
                    e.stopPropagation()
                    if (!notification.read && onMarkRead) onMarkRead(notification.id)
                    onNavigate(notification.actionUrl!)
                  }}
                >
                  Go to page <ArrowRight className="h-2.5 w-2.5" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
              </span>
              {hasDetails && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {expanded ? 'less' : 'details'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {expanded && hasDetails && (
        <div className="mx-3 mb-3 p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-1.5">
          {!!meta?.booking_reference && (
            <p className="text-[10px] font-mono text-muted-foreground mb-1">
              Ref: {String(meta.booking_reference)}
            </p>
          )}
          {visibleMeta.map(f => (
            <MetaRow
              key={f.key}
              icon={f.icon}
              label={f.label}
              value={String(meta?.[f.key])}
            />
          ))}
          {!!meta?.start_time && !!meta?.end_time && (
            <MetaRow icon={Clock} label="Time" value={`${String(meta.start_time)} – ${String(meta.end_time)}`} />
          )}
        </div>
      )}
    </div>
  )
}

export function NotificationBell({
  notifications,
  unreadCount,
  viewAllHref,
  onMarkRead,
  onMarkAllRead,
  onDeleteAll,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleNavigate = (url: string) => {
    setOpen(false)
    router.push(url)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllRead}
              className="h-7 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[380px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-10">
              <Bell className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.slice(0, 25).map(n => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  onMarkRead={onMarkRead}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="px-3 py-2 border-t flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => { setOpen(false); router.push(viewAllHref) }}
          >
            View all notifications
          </Button>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={onDeleteAll}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
