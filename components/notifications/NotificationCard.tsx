'use client'

import { useState } from 'react'
import {
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
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { UnifiedNotification } from '@/types/notifications'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'

const typeConfig = {
  info: {
    icon: Info,
    iconClass: 'text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-950/60',
    badgeClass: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
    dotClass: 'bg-blue-600 dark:bg-blue-400',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60',
    badgeClass: 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
    dotClass: 'bg-amber-600 dark:bg-amber-400',
  },
  success: {
    icon: CheckCircle,
    iconClass: 'text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60',
    badgeClass: 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
    dotClass: 'bg-emerald-600 dark:bg-emerald-400',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-800 dark:text-red-300 bg-red-100/80 dark:bg-red-950/60',
    badgeClass: 'text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800',
    dotClass: 'bg-red-600 dark:bg-red-400',
  },
} as const

interface MetaField {
  icon: React.ElementType
  label: string
  key: string
}

const META_FIELDS: MetaField[] = [
  { icon: User,     label: 'Requested by',   key: 'requester_name' },
  { icon: User,     label: 'Role',           key: 'requester_role' },
  { icon: MapPin,   label: 'Facility',       key: 'facility_name' },
  { icon: Calendar, label: 'Date',           key: 'booking_date' },
  { icon: Clock,    label: 'Duration',       key: 'duration' },
  { icon: Info,     label: 'Purpose',        key: 'purpose' },
  { icon: User,     label: 'Attendees',      key: 'expected_attendees' },
  { icon: User,     label: 'Decided by',     key: 'decided_by_name' },
  { icon: User,     label: 'Reviewer role',  key: 'decided_by_role' },
  { icon: Info,     label: 'Reason',         key: 'rejection_reason' },
  { icon: Info,     label: 'Revision notes', key: 'revision_notes' },
  { icon: Info,     label: 'Department',     key: 'department' },
  { icon: Info,     label: 'Term',           key: 'academic_term' },
  { icon: Info,     label: 'Entries',        key: 'total_entries' },
  { icon: User,     label: 'Submitted by',   key: 'submitted_by' },
]

interface NotificationCardProps {
  notification: UnifiedNotification
  onMarkRead?: (id: string) => void
  defaultExpanded?: boolean
}

function sanitizeText(str?: string | null): string {
  if (!str) return ''
  return str.replace(/\[Deleted User\]/g, 'Former Staff Member')
}

export function NotificationCard({ notification, onMarkRead, defaultExpanded = false }: NotificationCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const router = useRouter()
  const cfg = typeConfig[notification.type] ?? typeConfig.info
  const Icon = cfg.icon
  const meta = notification.metadata as Record<string, unknown> | undefined
  const hasDetails = !!meta && Object.keys(meta).filter(k => meta[k]).length > 0

  const visibleMeta = META_FIELDS.filter(f => meta?.[f.key] !== undefined && meta?.[f.key] !== null && String(meta[f.key]).trim())

  const cleanTitle = sanitizeText(notification.title)
  const cleanMessage = sanitizeText(notification.message)

  const handleToggle = () => {
    if (!notification.read && onMarkRead) onMarkRead(notification.id)
    if (hasDetails) setExpanded(e => !e)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle()
    }
  }

  return (
    <div 
      className={`group relative transition-all duration-200 border rounded-2xl ${
        notification.read 
          ? 'bg-white/60 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80 hover:bg-white dark:hover:bg-slate-900 shadow-sm' 
          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 shadow-md ring-1 ring-slate-900/5 dark:ring-white/5'
      } ${hasDetails ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100' : ''}`}
      role={hasDetails ? 'button' : undefined}
      tabIndex={hasDetails ? 0 : undefined}
      aria-expanded={hasDetails ? expanded : undefined}
      aria-label={`Notification: ${cleanTitle}. ${hasDetails ? (expanded ? 'Click to collapse details' : 'Click to expand details') : ''}`}
      onClick={handleToggle}
      onKeyDown={hasDetails ? handleKeyDown : undefined}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5 sm:gap-4">
          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${cfg.iconClass} shrink-0 mt-0.5`}>
            <Icon className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {!notification.read && (
                <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" title="Unread notification" />
              )}
              <span className={`shrink-0 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-bold border ${cfg.badgeClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                {notification.type}
              </span>
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap ml-auto sm:hidden">
                {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
              </span>
            </div>
            
            <h3 className={`text-sm sm:text-base leading-snug break-words ${!notification.read ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-700 dark:text-slate-300 font-semibold'}`}>
              {cleanTitle}
            </h3>
            
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1 break-words">
              {cleanMessage}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2 sm:ml-4 self-start mt-0.5">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap hidden sm:block mr-2">
              {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
            </span>
            
            {notification.actionUrl && (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 rounded-lg px-3.5 text-xs font-bold tracking-wide hidden md:flex border border-slate-200 dark:border-slate-700"
                onClick={e => {
                  e.stopPropagation()
                  if (!notification.read && onMarkRead) onMarkRead(notification.id)
                  router.push(notification.actionUrl!)
                }}
              >
                View Details
              </Button>
            )}
            
            {!notification.read && onMarkRead && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 rounded-lg p-0 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={e => { e.stopPropagation(); onMarkRead(notification.id) }}
                title="Mark as read"
                aria-label="Mark notification as read"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            
            {hasDetails && (
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded && hasDetails && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            {!!meta?.booking_reference && (
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Booking Reference</span>
                <span className="text-xs font-mono font-bold tracking-wider text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                  {String(meta.booking_reference)}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {visibleMeta.map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <f.icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 w-24">{f.label}</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {sanitizeText(String(meta?.[f.key]))}
                  </span>
                </div>
              ))}
              {!!meta?.start_time && !!meta?.end_time && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 w-24">Time</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{String(meta.start_time)} – {String(meta.end_time)}</span>
                </div>
              )}
            </div>
            {notification.actionUrl && (
              <div className="pt-2 flex md:hidden">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full rounded-lg h-9 text-xs font-bold"
                  onClick={e => { e.stopPropagation(); router.push(notification.actionUrl!) }}
                >
                  View Details
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
