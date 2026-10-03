"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Calendar, Sun, Moon, Bell, Mail, PlusCircle, Type
} from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { UserProfile } from "@/components/layout/shared/UserProfile"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"
import { useUI } from "@/contexts/UIContext"
import { TextSizeControlMenu } from "@/components/shared/TextSizeControlMenu"
import { ROUTES } from '@/lib/routes'

const MESSAGING_ENABLED = false;

export function AcademicHeadHeader() {
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { textSizeEnlarged, toggleTextSize } = useUI()

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/academic-head/notifications?limit=5')
      if (res.ok) {
        const data = await res.json()
        const count = (data.notifications || []).filter((n: any) => !n.read).length
        setUnreadCount(count)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (mounted) {
      fetchNotifications()
      const interval = setInterval(fetchNotifications, 60000)
      return () => clearInterval(interval)
    }
  }, [fetchNotifications, mounted])

  if (!mounted) {
    return <header className="h-[70px] w-full border-b border-border/40 bg-white dark:bg-[#0F1113]" />
  }

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark")

  return (
    <header className={cn(
      "flex items-center justify-between px-6 h-[70px] sticky top-0 z-[50] w-full transition-all duration-500",
      "bg-white/80 dark:bg-[#0F1113]/90 backdrop-blur-md",
      "border-b border-neutral-200 dark:border-white/5"
    )}>
      {/* Pushes all content to the right side */}
      <div className="flex-1" />

      {/* Navigation & User Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        
        {/* Quick Action Button */}
        <Button 
          onClick={() => router.push(ROUTES.academic.reserve)}
          className={cn(
            "flex items-center gap-2 rounded-2xl font-black text-[10px] uppercase tracking-wider px-5 h-10 transition-all active:scale-95 shadow-lg shadow-yellow-500/10 dark:shadow-blue-600/10",
            "bg-yellow-500 hover:bg-yellow-600 text-white",
            "dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
          )}
        >
          <PlusCircle size={15} />
          Quick Book
        </Button>

        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={200}>

            <HeaderAction
              icon={<Calendar size={18} />}
              tooltip="Calendar View"
              onClick={() => router.push(ROUTES.academic.schedulesCalendar)}
            />

            <div className="relative">
              <HeaderAction
                icon={<Bell size={18} />}
                tooltip="Alerts"
                onClick={() => router.push(ROUTES.academic.notifications)}
              />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white dark:border-[#0F1113]" />
              )}
            </div>

            {MESSAGING_ENABLED && (
              <HeaderAction
                icon={<Mail size={18} />}
                tooltip="Messages"
                onClick={() => router.push(ROUTES.academic.messages)}
              />
            )}

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

          {/* User Profile - Now dynamic, no props needed */}
          <div className="ml-2 pl-4 border-l border-neutral-200 dark:border-white/10 h-10 flex items-center cursor-pointer hover:opacity-80 transition-all">
            <UserProfile />
          </div>
        </div>
      </div>
    </header>
  )
}

const HeaderAction = ({
  icon, tooltip, onClick, active = false
}: {
  icon: React.ReactNode; tooltip: string; onClick?: () => void; active?: boolean;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={cn(
          "rounded-xl h-10 w-10 transition-all active:scale-90",
          active
            ? "bg-blue-600/10 text-blue-600 dark:text-blue-400"
            : "text-muted-foreground/60 dark:text-[#444444] hover:text-foreground dark:hover:text-[#cccccc] hover:bg-accent/50 dark:hover:bg-[#1A1D21]"
        )}
      >
        {icon}
      </Button>
    </TooltipTrigger>
    <TooltipContent
      side="bottom"
      className="bg-neutral-900 dark:bg-[#1A1D21] text-white border border-neutral-700 dark:border-white/10 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5"
    >
      {tooltip}
    </TooltipContent>
  </Tooltip>
)