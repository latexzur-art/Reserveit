'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Menu, MessageSquare, Bell, Calendar, Sun, Moon, PlusCircle, Type
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { NotificationCenter } from '@/components/shared/NotificationCenter'
import type { UnifiedNotification } from '@/types/notifications'
import { cn } from '@/lib/utils'
import { useUI } from '@/contexts/UIContext'
import { TextSizeControlMenu } from '@/components/shared/TextSizeControlMenu'

/**
 * Shared top bar for role dashboards. Consolidates the formerly duplicated
 * FacultyTopBar copies (faculty + program head) — role differences are
 * expressed via formRoute, calendarRoute, and the profileMenu slot.
 */
export interface RoleTopBarProps {
  title: string
  portalTitle?: string
  breadcrumbs?: { label: string; href?: string }[]
  notifications: UnifiedNotification[]
  unreadCount: number
  onMarkNotificationRead: (id: string) => void
  onMarkAllNotificationsRead: () => void
  onClearAllNotifications: () => void
  onOpenMessageCenter: () => void
  onMobileMenuToggle?: () => void
  /** Quick Book destination — role-specific booking form. */
  formRoute: string
  /** Calendar icon destination — role-specific calendar page. */
  calendarRoute: string
  /** Role-specific profile dropdown (rendered at the far right). */
  profileMenu: React.ReactNode
  viewAllHref?: string
}

export const RoleTopBar = ({
  title,
  portalTitle,
  notifications,
  unreadCount,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onClearAllNotifications,
  onOpenMessageCenter,
  onMobileMenuToggle,
  formRoute,
  calendarRoute,
  profileMenu,
  viewAllHref,
}: RoleTopBarProps) => {
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { textSizeEnlarged, toggleTextSize } = useUI()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <header className="h-[70px] w-full border-b border-neutral-200 dark:border-white/5 bg-white dark:bg-[#0D0F12]" />
  }

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')

  return (
    <header className={cn(
      "flex items-center justify-between px-4 sm:px-6 lg:px-8 h-[70px] sticky top-0 z-[50] w-full transition-all font-sans",
      "bg-white/80 dark:bg-[#0D0F12]/80 backdrop-blur-xl",
      "border-b border-neutral-200 dark:border-white/5"
    )}>
      {/* Left side: Mobile Toggle & push actions to right */}
      <div className="flex items-center gap-2 flex-1">
        {onMobileMenuToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileMenuToggle}
            className="lg:hidden h-10 w-10 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </div>

        {/* Right side: Actions & User */}
        <div className="flex items-center gap-1.5 sm:gap-3">

          {/* Quick Book Button */}
          <Button
            onClick={() => router.push(formRoute)}
            className={cn(
              "flex items-center gap-2 rounded-2xl font-black text-[10px] uppercase tracking-wider px-5 h-10 transition-all active:scale-95 shadow-lg",
              "bg-yellow-500 hover:bg-yellow-400 text-sti-navy dark:text-slate-950 font-bold shadow-yellow-500/10"
            )}
          >
            <PlusCircle size={15} />
            <span className="hidden sm:inline">Quick Book</span>
          </Button>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <TooltipProvider delayDuration={200}>

              <HeaderAction
                icon={<Calendar size={18} />}
                tooltip="Calendar View"
                onClick={() => router.push(calendarRoute)}
              />

              <div className="relative">
                <HeaderAction
                  icon={<Bell size={18} />}
                  tooltip="Notifications"
                >
                  <NotificationCenter
                    notifications={notifications}
                    unreadCount={unreadCount}
                    onMarkRead={onMarkNotificationRead}
                    onMarkAllRead={onMarkAllNotificationsRead}
                    onClearAll={onClearAllNotifications}
                    viewAllHref={viewAllHref}
                  />
                </HeaderAction>
              </div>

              <HeaderAction
                icon={<MessageSquare size={18} />}
                tooltip="Messages"
                onClick={onOpenMessageCenter}
              />

              <TextSizeControlMenu />

              <HeaderAction
                icon={
                  resolvedTheme === 'dark'
                    ? <Sun size={18} className="text-yellow-400" />
                    : <Moon size={18} className="text-[#0072bc]" />
                }
                tooltip={resolvedTheme === 'dark' ? "Light Mode" : "Dark Mode"}
                onClick={toggleTheme}
              />

            </TooltipProvider>

            <div className="ml-2 pl-3 border-l border-neutral-200 dark:border-white/10 h-8 flex items-center">
              {profileMenu}
            </div>
          </div>
        </div>
      </header>
  )
}

const HeaderAction = ({
  icon, tooltip, onClick, children, active = false
}: {
  icon?: React.ReactNode
  tooltip: string
  onClick?: () => void
  children?: React.ReactNode
  active?: boolean
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="relative">
        {children ? (
          children
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            className={cn(
              "rounded-xl h-10 w-10 transition-all active:scale-90",
              active
                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20"
                : "text-muted-foreground/60 dark:text-slate-400 hover:text-foreground dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            )}
          >
            {icon}
          </Button>
        )}
      </div>
    </TooltipTrigger>
    <TooltipContent
      side="bottom"
      className="bg-neutral-900 dark:bg-[#1A1D21] text-white border border-neutral-700 dark:border-white/10 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5"
    >
      {tooltip}
    </TooltipContent>
  </Tooltip>
)
