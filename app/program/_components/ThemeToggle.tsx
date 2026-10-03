'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ThemeToggleProps {
  collapsed?: boolean
}

export const ThemeToggle = ({ collapsed = false }: ThemeToggleProps) => {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent">
        <Monitor className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="text-xs">Theme</span>}
      </Button>
    )
  }

  const cycle = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const icon = theme === 'dark' ? <Moon className="h-4 w-4 shrink-0" /> :
               theme === 'light' ? <Sun className="h-4 w-4 shrink-0" /> :
               <Monitor className="h-4 w-4 shrink-0" />

  const label = theme === 'dark' ? 'Dark' :
                theme === 'light' ? 'Light' : 'System'

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycle}
      className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      title={`Theme: ${label}`}
    >
      {icon}
      {!collapsed && <span className="text-xs">{label}</span>}
    </Button>
  )
}
