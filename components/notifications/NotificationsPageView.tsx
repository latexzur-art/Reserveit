'use client'

import React, { useState } from 'react'
import {
  Bell, CheckCheck, Trash2,
  Info, AlertTriangle, CheckCircle, XCircle,
  Search, Filter, Calendar, MapPin, Clock, User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { formatDistanceToNow, format } from 'date-fns'
import type { UnifiedNotification } from '@/types/notifications'

interface NotificationsPageViewProps {
  notifications: UnifiedNotification[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onClearAll: () => void
  title?: string
}

const typeConfig = {
  info:    { icon: Info,          iconClass: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',     borderClass: 'border-l-blue-400', label: 'Info' },
  warning: { icon: AlertTriangle, iconClass: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400', borderClass: 'border-l-amber-400', label: 'Warning' },
  success: { icon: CheckCircle,   iconClass: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400', borderClass: 'border-l-emerald-400', label: 'Success' },
  error:   { icon: XCircle,       iconClass: 'text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-400',         borderClass: 'border-l-red-400', label: 'Error' },
} as const

const META_FIELDS: { icon: React.ElementType; label: string; key: string }[] = [
  { icon: User,     label: 'By',        key: 'requester_name' },
  { icon: User,     label: 'Role',      key: 'requester_role' },
  { icon: MapPin,   label: 'Facility',  key: 'facility_name' },
  { icon: Calendar, label: 'Date',      key: 'booking_date' },
  { icon: Clock,    label: 'Duration',  key: 'duration' },
  { icon: Info,     label: 'Purpose',   key: 'purpose' },
]

export function NotificationsPageView({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  title = "Notifications"
}: NotificationsPageViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string | 'all'>('all')

  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          n.message.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterType === 'all' || n.type === filterType
    return matchesSearch && matchesFilter
  })

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header Section */}
      <div className="px-8 py-8 border-b border-border/40 bg-card">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 md:items-end justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Bell className="w-8 h-8 text-blue-500" />
              {title}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              View and manage your recent activity, alerts, and system updates.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <Button onClick={onMarkAllRead} variant="outline" className="gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-500" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2 text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                    Clear all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently clear all your notifications. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Clear all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-card rounded-2xl border border-border/50">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search notifications..."
                className="pl-9 bg-background/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
              <Button 
                variant={filterType === 'all' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setFilterType('all')}
                className="rounded-full"
              >
                All
              </Button>
              {Object.entries(typeConfig).map(([type, cfg]) => (
                <Button
                  key={type}
                  variant={filterType === type ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterType(type)}
                  className="rounded-full gap-1.5"
                >
                  <cfg.icon className="w-3.5 h-3.5" />
                  {cfg.label}
                </Button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-2xl bg-card/50">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-lg">No notifications found</h3>
                <p className="text-muted-foreground text-sm max-w-sm mt-1">
                  You{"'"}re all caught up! Check back later for updates.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const cfg = typeConfig[notif.type] ?? typeConfig.info
                const Icon = cfg.icon
                const meta = notif.metadata as Record<string, unknown> | undefined
                const hasDetails = !!meta && META_FIELDS.some(f => meta[f.key])
                
                return (
                  <div 
                    key={notif.id}
                    onClick={() => !notif.read && onMarkRead(notif.id)}
                    className={`group relative flex flex-col md:flex-row gap-4 p-5 rounded-2xl border transition-all duration-300 cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${
                      notif.read 
                        ? 'bg-card border-border/20 shadow-sm hover:border-border/40' 
                        : 'bg-primary/[0.03] border-primary/20 shadow-sm'
                    }`}
                  >
                    {!notif.read && (
                      <div className="absolute top-6 right-6 w-2 h-2 rounded-full bg-primary ring-4 ring-primary/20 animate-pulse" />
                    )}
                    
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.iconClass} ring-4 ring-background shadow-sm`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1.5">
                        <h4 className={`text-base font-semibold leading-tight pr-6 ${!notif.read ? 'text-foreground' : 'text-foreground/80'}`}>
                          {notif.title}
                        </h4>
                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      
                      <p className={`text-sm leading-relaxed mb-4 ${!notif.read ? 'text-foreground/90 font-medium' : 'text-muted-foreground'}`}>
                        {notif.message}
                      </p>
                      
                      {hasDetails && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {META_FIELDS.map(f => {
                            const val = meta?.[f.key]
                            if (!val) return null
                            return (
                              <div key={f.key} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors rounded-lg border border-border/50 shadow-sm">
                                <f.icon className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{f.label}:</span>
                                <span className="text-xs font-semibold">{String(val)}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      
                      {notif.actionUrl && (
                        <div className="pt-2">
                          <Button 
                            variant={notif.read ? "secondary" : "default"}
                            size="sm"
                            className="rounded-full px-5 text-xs font-bold tracking-wide"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.location.href = notif.actionUrl!
                            }}
                          >
                            View Details
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
