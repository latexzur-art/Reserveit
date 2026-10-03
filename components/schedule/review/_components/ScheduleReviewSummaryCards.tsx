'use client'

import { cn } from '@/lib/utils'

interface SummaryCardData {
    label: string
    value: number
    color: string
}

interface ScheduleReviewSummaryCardsProps {
    counts: {
        total: number
        pending: number
        approved: number
        published: number
        flagged: number
        rejected: number
        conflicts: number
    }
}

export function ScheduleReviewSummaryCards({ counts }: ScheduleReviewSummaryCardsProps) {
    const cards: SummaryCardData[] = [
        { label: 'Total', value: counts.total, color: 'text-foreground' },
        { label: 'Pending', value: counts.pending, color: 'text-cyan-600 dark:text-cyan-400' },
        { label: 'Approved', value: counts.approved, color: 'text-emerald-600 dark:text-emerald-400' },
        { label: 'Published', value: counts.published, color: 'text-blue-600 dark:text-blue-400' },
        { label: 'Flagged', value: counts.flagged, color: 'text-amber-600 dark:text-amber-400' },
        { label: 'Rejected', value: counts.rejected, color: 'text-red-600 dark:text-red-400' },
        { label: 'Conflicts', value: counts.conflicts, color: 'text-orange-600 dark:text-orange-400' },
    ]

    return (
        <div className="flex flex-wrap items-center divide-x divide-border bg-card border border-border rounded-lg py-2 px-4 w-fit">
            {cards.map(s => (
                <div key={s.label} className="flex items-baseline gap-2 px-4 first:pl-0 last:pr-0">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</span>
                    <span className={cn('text-base font-bold', s.color)}>{s.value}</span>
                </div>
            ))}
        </div>
    )
}
