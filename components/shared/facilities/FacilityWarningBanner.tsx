'use client'

import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FacilityWarning } from '@/backend/admin/building/building.types'

const SEVERITY_STYLE: Record<string, { icon: typeof AlertTriangle; classes: string }> = {
  info: { icon: Info, classes: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900' },
  warning: { icon: AlertTriangle, classes: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900' },
  critical: { icon: ShieldAlert, classes: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900' },
}

export function FacilityWarningBanner({ warnings }: { warnings: FacilityWarning[] }) {
  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
        No active warnings — this room is in good standing.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" /> Active Room Warnings
      </p>
      {warnings.map(w => {
        const style = SEVERITY_STYLE[w.severity] || SEVERITY_STYLE.warning
        const Icon = style.icon
        return (
          <div key={w.id} className={cn('flex items-start gap-2 p-3 rounded-xl border text-sm', style.classes)}>
            <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span><span className="sr-only capitalize">{w.severity} notice: </span>{w.message}</span>
          </div>
        )
      })}
    </div>
  )
}
