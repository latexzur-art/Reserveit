'use client'

import {
  Monitor,
  Terminal,
  Cpu,
  Briefcase,
  Utensils,
  Compass,
  Palette,
  GraduationCap,
  School,
  BookOpen,
  Laptop,
  Building2,
  Code2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProgramStyle {
  icon: typeof Monitor
  bgClass: string
  textClass: string
  borderClass: string
  badgeClass: string
  hoverBgClass: string
}

const PROGRAM_MAP: Record<string, ProgramStyle> = {
  BSCS: {
    icon: Monitor,
    bgClass: 'bg-blue-500/10 dark:bg-blue-500/15',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-500/20 dark:border-blue-500/30',
    badgeClass: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
    hoverBgClass: 'group-hover:bg-blue-600 group-hover:text-white',
  },
  BSIT: {
    icon: Laptop,
    bgClass: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    textClass: 'text-cyan-600 dark:text-cyan-400',
    borderClass: 'border-cyan-500/20 dark:border-cyan-500/30',
    badgeClass: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30',
    hoverBgClass: 'group-hover:bg-cyan-600 group-hover:text-white',
  },
  BSCPE: {
    icon: Cpu,
    bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-500/20 dark:border-emerald-500/30',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
    hoverBgClass: 'group-hover:bg-emerald-600 group-hover:text-white',
  },
  BSBA: {
    icon: Briefcase,
    bgClass: 'bg-amber-500/10 dark:bg-amber-500/15',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500/20 dark:border-amber-500/30',
    badgeClass: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
    hoverBgClass: 'group-hover:bg-amber-600 group-hover:text-white',
  },
  BSA: {
    icon: Building2,
    bgClass: 'bg-amber-500/10 dark:bg-amber-500/15',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500/20 dark:border-amber-500/30',
    badgeClass: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
    hoverBgClass: 'group-hover:bg-amber-600 group-hover:text-white',
  },
  BSHM: {
    icon: Utensils,
    bgClass: 'bg-purple-500/10 dark:bg-purple-500/15',
    textClass: 'text-purple-600 dark:text-purple-400',
    borderClass: 'border-purple-500/20 dark:border-purple-500/30',
    badgeClass: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
    hoverBgClass: 'group-hover:bg-purple-600 group-hover:text-white',
  },
  BSTM: {
    icon: Compass,
    bgClass: 'bg-sky-500/10 dark:bg-sky-500/15',
    textClass: 'text-sky-600 dark:text-sky-400',
    borderClass: 'border-sky-500/20 dark:border-sky-500/30',
    badgeClass: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
    hoverBgClass: 'group-hover:bg-sky-600 group-hover:text-white',
  },
  MAWD: {
    icon: Palette,
    bgClass: 'bg-pink-500/10 dark:bg-pink-500/15',
    textClass: 'text-pink-600 dark:text-pink-400',
    borderClass: 'border-pink-500/20 dark:border-pink-500/30',
    badgeClass: 'bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-500/30',
    hoverBgClass: 'group-hover:bg-pink-600 group-hover:text-white',
  },
}

const DEFAULT_STYLE: ProgramStyle = {
  icon: GraduationCap,
  bgClass: 'bg-blue-500/10 dark:bg-blue-500/15',
  textClass: 'text-blue-600 dark:text-blue-400',
  borderClass: 'border-blue-500/20 dark:border-blue-500/30',
  badgeClass: 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10',
  hoverBgClass: 'group-hover:bg-blue-600 group-hover:text-white',
}

export function getProgramStyle(code?: string, name?: string): ProgramStyle {
  if (!code && !name) return DEFAULT_STYLE

  const normalizedCode = (code || '').toUpperCase().trim()
  const normalizedName = (name || '').toUpperCase().trim()

  for (const [key, style] of Object.entries(PROGRAM_MAP)) {
    if (normalizedCode.includes(key) || normalizedName.includes(key)) {
      return style
    }
  }

  if (normalizedCode.includes('CS') || normalizedName.includes('COMPUTER SCIENCE')) {
    return PROGRAM_MAP.BSCS
  }
  if (normalizedCode.includes('IT') || normalizedName.includes('INFORMATION TECH')) {
    return PROGRAM_MAP.BSIT
  }
  if (normalizedCode.includes('CPE') || normalizedName.includes('COMPUTER ENG')) {
    return PROGRAM_MAP.BSCPE
  }
  if (normalizedCode.includes('BUS') || normalizedName.includes('BUSINESS')) {
    return PROGRAM_MAP.BSBA
  }
  if (normalizedCode.includes('TOUR') || normalizedName.includes('TOURISM')) {
    return PROGRAM_MAP.BSTM
  }
  if (normalizedCode.includes('HOSP') || normalizedName.includes('HOTEL')) {
    return PROGRAM_MAP.BSHM
  }

  return DEFAULT_STYLE
}

interface SectionBadgeIconProps {
  departmentCode?: string
  departmentName?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function SectionBadgeIcon({
  departmentCode,
  departmentName,
  size = 'md',
  className
}: SectionBadgeIconProps) {
  const style = getProgramStyle(departmentCode, departmentName)
  const Icon = style.icon

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg text-xs',
    md: 'w-11 h-11 rounded-xl text-sm',
    lg: 'w-12 h-12 rounded-xl text-base',
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center border transition-all shrink-0 shadow-xs',
        style.bgClass,
        style.textClass,
        style.borderClass,
        style.hoverBgClass,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
    </div>
  )
}
