'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sun, Moon, Bell } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { UserProfile } from '@/components/layout/shared/UserProfile'
import { cn } from '@/lib/utils'
import { TextSizeControlMenu } from '@/components/shared/TextSizeControlMenu'
import { ROUTES } from '@/lib/routes'

export function PamoHeader() {
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <header className="h-[70px] w-full border-b border-neutral-200 dark:border-white/5 bg-white dark:bg-[#0D0F12]" />
    )
  }

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')

  return (
    <header
      className={cn(
        'flex items-center justify-between px-4 sm:px-6 lg:px-8 h-[70px] sticky top-0 z-[50] w-full transition-all font-sans',
        'bg-white/80 dark:bg-[#0D0F12]/80 backdrop-blur-xl',
        'border-b border-neutral-200 dark:border-white/5'
      )}
    >
      {/* LEFT & CENTER: Empty to push actions to the right */}
      <div className="flex-1" />

      {/* RIGHT: Action Icons & Profile */}
      <div className="flex items-center gap-0.5 sm:gap-1.5">
        <TooltipProvider delayDuration={200}>
          <div className="relative">
            <HeaderAction
              icon={<Bell size={17} strokeWidth={2.5} />}
              tooltip="Recent Alerts"
              onClick={() => router.push(ROUTES.pamo.notifications)}
            />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-[#0D0F12] pointer-events-none" />
          </div>

          <TextSizeControlMenu />

          <HeaderAction
            icon={
              resolvedTheme === 'dark' ? (
                <Sun size={17} strokeWidth={2.5} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]" />
              ) : (
                <Moon size={17} strokeWidth={2.5} className="text-[#0072bc]" />
              )
            }
            tooltip={resolvedTheme === 'dark' ? 'Enable Light Mode' : 'Enable Dark Mode'}
            onClick={toggleTheme}
          />
        </TooltipProvider>

        {/* User Profile */}
        <div className="ml-3 pl-3 sm:ml-4 sm:pl-4 border-l border-neutral-200 dark:border-white/10 h-8 flex items-center cursor-pointer hover:opacity-80 transition-all">
          <UserProfile />
        </div>
      </div>
    </header>
  )
}

const HeaderAction = ({
  icon,
  tooltip,
  onClick,
  active = false,
  className,
}: {
  icon: React.ReactNode
  tooltip: string
  onClick?: () => void
  active?: boolean
  className?: string
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={cn(
          'rounded-xl h-10 w-10 transition-all active:scale-90 font-sans',
          active
            ? 'bg-[var(--accent-brand)]/10 text-[var(--accent-brand)]'
            : 'text-neutral-500 dark:text-slate-400 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white',
          className
        )}
      >
        {icon}
      </Button>
    </TooltipTrigger>
    <TooltipContent
      side="bottom"
      className="bg-neutral-900 dark:bg-slate-800 text-white border-none rounded-lg text-[9px] font-black uppercase tracking-widest px-3 py-1.5"
    >
      {tooltip}
    </TooltipContent>
  </Tooltip>
)
