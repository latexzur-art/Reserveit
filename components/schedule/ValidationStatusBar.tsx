'use client'

/**
 * ValidationStatusBar — Summary counters for schedule entry validation results.
 */

import { CheckCircle2, AlertTriangle, XCircle, Clock, FileSpreadsheet, AlertOctagon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ValidationCounts {
    total: number
    valid: number
    warnings: number
    errors: number
    pending: number
    conflicts: number
}

interface ValidationStatusBarProps {
    counts: ValidationCounts
    className?: string
}

export function ValidationStatusBar({ counts, className }: ValidationStatusBarProps) {
    const items = [
        { label: 'Total', value: counts.total, icon: FileSpreadsheet, color: 'text-white', bg: 'bg-white/5' },
        { label: 'Valid', value: counts.valid, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
        { label: 'Warnings', value: counts.warnings, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/5' },
        { label: 'Conflicts', value: counts.conflicts, icon: AlertOctagon, color: 'text-orange-400', bg: 'bg-orange-500/5' },
        { label: 'Pending', value: counts.pending, icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/5' },
    ]

    const validPercent = counts.total > 0 ? Math.round((counts.valid / counts.total) * 100) : 0

    return (
        <div className={cn('space-y-3', className)}>
            {/* Progress bar */}
            <div className="bg-white/5 rounded-full h-2 overflow-hidden">
                <div className="flex h-full">
                    <div
                        className="bg-emerald-500 transition-all duration-500"
                        style={{ width: `${counts.total > 0 ? (counts.valid / counts.total) * 100 : 0}%` }}
                    />
                    <div
                        className="bg-amber-500 transition-all duration-500"
                        style={{ width: `${counts.total > 0 ? (counts.warnings / counts.total) * 100 : 0}%` }}
                    />
                    <div
                        className="bg-orange-500 transition-all duration-500"
                        style={{ width: `${counts.total > 0 ? (counts.conflicts / counts.total) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Counters */}
            <div className="flex flex-wrap gap-2">
                {items.map(item => (
                    <div
                        key={item.label}
                        className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10',
                            item.bg,
                        )}
                    >
                        <item.icon className={cn('h-4 w-4', item.color)} />
                        <div className="text-xs">
                            <span className={cn('font-bold', item.color)}>{item.value}</span>
                            <span className="text-slate-500 ml-1">{item.label}</span>
                        </div>
                    </div>
                ))}

                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 ml-auto">
                    <span className="text-[10px] text-slate-500">Pass rate:</span>
                    <span className={cn(
                        'text-sm font-bold',
                        validPercent >= 80 ? 'text-emerald-400' : validPercent >= 50 ? 'text-amber-400' : 'text-red-400',
                    )}>
                        {validPercent}%
                    </span>
                </div>
            </div>
        </div>
    )
}
