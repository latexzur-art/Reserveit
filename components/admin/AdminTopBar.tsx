'use client'

import { Menu, MessageSquare, ChevronRight, Terminal, Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationCenter } from './users/NotificationCenter'
import { ProfileDropdown } from './users/ProfileDropdown'
import { useUI } from '@/contexts/UIContext'
import { TextSizeControlMenu } from '@/components/shared/TextSizeControlMenu'
import type { Notification } from '@/backend/admin/admin.types'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ROUTES } from '@/lib/routes'

interface AdminTopBarProps {
  title: string
  breadcrumbs?: { label: string; href?: string }[]
  notifications: Notification[]
  unreadCount: number
  onMarkNotificationRead: (id: string) => void
  onMarkAllNotificationsRead: () => void
  onClearAllNotifications: () => void
  onOpenMessageCenter: () => void
  onMobileMenuToggle?: () => void;
  /** Hide the compact in-bar title when the page renders its own hero heading. */
  hideTitle?: boolean;
}

export const AdminTopBar = ({
  title,
  breadcrumbs = [],
  notifications,
  unreadCount,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onClearAllNotifications,
  onOpenMessageCenter,
  onMobileMenuToggle,
  hideTitle = false,
}: AdminTopBarProps) => {
  const { toggleMobileMenu, textSizeEnlarged, toggleTextSize } = useUI();
  const handleToggle = onMobileMenuToggle || toggleMobileMenu;

  return (
    /* z-50 ensures it stays above all table content and modals */
    <div className="sticky top-0 z-50 w-full shrink-0">
      <header className="h-[70px] bg-white/95 dark:bg-[#0D0F12]/95 backdrop-blur-sm border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 lg:px-8">
        
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            className="lg:hidden h-10 w-10 rounded-xl text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 transition-all"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex flex-col">
            {breadcrumbs.length > 0 && (
              <nav className="flex items-center gap-1.5">
                {breadcrumbs.map((crumb, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {crumb.label}
                    </span>
                    {(i < breadcrumbs.length - 1 || !hideTitle) && (
                      <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                ))}
              </nav>
            )}

            {!hideTitle && (
              <div className="flex items-center gap-2 mt-0.5">
                <Terminal size={14} className="text-blue-500 hidden sm:block" />
                <h1 className="text-sm font-semibold text-[#050d36] dark:text-white">
                  {title}
                </h1>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden md:flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-white/10">
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenMessageCenter}
              className="h-9 rounded-xl text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-600/10 transition-all gap-2 px-4 group"
            >
              <MessageSquare className="h-4 w-4 transition-transform group-hover:-rotate-12" />
              <span className="text-xs font-medium">Comm Center</span>
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <TextSizeControlMenu />

            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={onMarkNotificationRead}
              onMarkAllRead={onMarkAllNotificationsRead}
              onClearAll={onClearAllNotifications}
              viewAllHref={ROUTES.buildingAdmin.notifications}
            />
            <div className="ml-2 pl-2 border-l border-slate-200 dark:border-white/10">
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </header>
    </div>
  )
}