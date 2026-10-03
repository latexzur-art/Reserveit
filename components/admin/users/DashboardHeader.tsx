'use client'

import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationCenter } from './NotificationCenter'
import { ProfileDropdown } from './ProfileDropdown'
import type { Notification } from '@/backend/admin/admin.types'

import { TenantSwitcherBadge } from './TenantSwitcherBadge'

interface DashboardHeaderProps {
  notifications: Notification[]
  unreadCount: number
  onMarkNotificationRead: (id: string) => void
  onMarkAllNotificationsRead: () => void
  onClearAllNotifications: () => void
  onOpenMessageCenter: () => void
}

export const DashboardHeader = ({
  notifications,
  unreadCount,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onClearAllNotifications,
  onOpenMessageCenter,
}: DashboardHeaderProps) => {
  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ReserveIT Logo" className="w-11 h-11 object-contain shrink-0" />
            <div>
              <h1 className="text-lg font-bold leading-none">ReserveIT</h1>
              <p className="text-xs text-primary-foreground/70">User Management</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenMessageCenter}
              className="text-primary-foreground hover:bg-primary-foreground/10 gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Message Center</span>
            </Button>

            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={onMarkNotificationRead}
              onMarkAllRead={onMarkAllNotificationsRead}
              onClearAll={onClearAllNotifications}
            />

            <div className="w-px h-8 bg-primary-foreground/20 mx-1" />

            <ProfileDropdown />
          </div>
        </div>
      </div>

      <div className="bg-primary-foreground/10 border-t border-primary-foreground/10">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <nav className="text-sm text-primary-foreground/70">
            <span>Dashboard</span>
            <span className="mx-2">/</span>
            <span className="text-primary-foreground font-medium">Users Management</span>
          </nav>
          <TenantSwitcherBadge />
        </div>
      </div>
    </header>
  )
}
