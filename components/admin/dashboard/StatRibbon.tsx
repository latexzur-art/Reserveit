'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { cn } from '@/lib/utils'

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

export interface StatRibbonItem {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  /** When set, the segment becomes a drill-down link. */
  href?: string
  /** `warning` draws attention to an exceptional count (e.g. items in maintenance). */
  tone?: 'default' | 'warning'
}

/**
 * Authored institutional stat treatment: one unified surface, hairline-divided
 * into segments (via the bg-border gap technique, robust across the 2-col and
 * 4-col responsive grids). No per-metric floating cards, no colored icon tiles —
 * tabular figures and muted micro-labels, so the data on the page keeps primacy.
 * Segments can optionally drill down (`href`) or flag an exception (`tone`).
 * Designed for ~4 items.
 */
export const StatRibbon = ({ items }: { items: StatRibbonItem[] }) => {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
      {items.map((item) => {
        const warning = item.tone === 'warning'
        const cellClass = cn(
          'group flex flex-col gap-1.5 bg-card px-5 py-4 outline-none transition-colors',
          item.href && 'hover:bg-muted/50 focus-visible:bg-muted/50',
        )
        const body = (
          <>
            <div
              className={cn(
                'flex items-center gap-1.5',
                warning ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
              {item.href && (
                <ArrowUpRight
                  className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden="true"
                />
              )}
            </div>
            <span
              className={cn(
                'text-3xl font-black leading-none tracking-tight tabular-nums',
                warning ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
              )}
            >
              {item.value}
            </span>
            {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
          </>
        )

        return item.href ? (
          <Link key={item.label} href={item.href} className={cellClass} aria-label={`${item.value} ${item.label}`}>
            {body}
          </Link>
        ) : (
          <div key={item.label} className={cellClass} aria-label={`${item.value} ${item.label}`}>
            {body}
          </div>
        )
      })}
    </div>
  )
}
