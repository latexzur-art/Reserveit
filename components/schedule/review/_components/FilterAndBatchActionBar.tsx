'use client'

import {
    AlertTriangle,
    Check,
    X,
    ChevronDown,
    Loader2,
    Rocket,
    RotateCcw,
    Sparkles,
    Flag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const REVIEW_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    pending_review: { label: 'Pending', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20', icon: null },
    academic_head_approved: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20', icon: null },
    academic_head_flagged: { label: 'Flagged', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20', icon: null },
    academic_head_rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20', icon: null },
}

interface FilterAndBatchActionBarProps {
    filterMode: 'review' | 'validation'
    filterStatus: string
    setFilterStatus: (s: string) => void
    counts: { published: number }
    validationCounts: { total: number; valid: number; warnings: number; errors: number; conflicts: number }
    failedPublishRows: Set<number>
    entries: any[]
    problematicEntries: any[]
    conflictedEntries: any[]
    selected: Set<string>
    hasPublishedSelected: boolean
    hasConflictSelected: boolean
    reviewNotes: string
    setReviewNotes: (v: string) => void
    actionLoading: boolean
    publishing: boolean
    autoFixing: string | null
    autoFixingAll: boolean
    resolvingConflicts: boolean
    /** Whether the user can approve/reject/publish — false for program heads. */
    canPublish?: boolean
    onBatchAction: (action: 'academic_head_approved' | 'academic_head_flagged' | 'academic_head_rejected') => void
    onApproveAndPublish: () => void
    onBatchRollback: () => void
    onAutoFixAll: () => void
    onAutoResolveConflicts: (mode: 'room' | 'time' | 'both') => void
}

export function FilterAndBatchActionBar({
    filterMode,
    filterStatus,
    setFilterStatus,
    counts,
    validationCounts,
    failedPublishRows,
    entries,
    problematicEntries,
    conflictedEntries,
    selected,
    hasPublishedSelected,
    hasConflictSelected,
    reviewNotes,
    setReviewNotes,
    actionLoading,
    publishing,
    autoFixing,
    autoFixingAll,
    resolvingConflicts,
    canPublish = false,
    onBatchAction,
    onApproveAndPublish,
    onBatchRollback,
    onAutoFixAll,
    onAutoResolveConflicts,
}: FilterAndBatchActionBarProps) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 border border-border border-b-0 rounded-t-xl p-3">
            <div className="flex flex-wrap items-center gap-2">
                {problematicEntries.length > 0 && (
                    <button
                        onClick={onAutoFixAll}
                        disabled={autoFixingAll || !!autoFixing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-ah-sti-cyan/20 hover:bg-ah-sti-cyan/30 text-ah-sti-cyan rounded-md text-xs font-medium border border-ah-sti-cyan/30 transition-colors disabled:opacity-50"
                        title="Auto-assign best available facility for all unmatched/low-confidence entries"
                    >
                        {autoFixingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Auto-fix Facilities ({problematicEntries.length})
                    </button>
                )}
                {conflictedEntries.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                disabled={resolvingConflicts}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-md text-xs font-medium border border-orange-500/30 transition-colors disabled:opacity-50"
                                title="Auto-assign available rooms/slots for conflicting entries"
                            >
                                {resolvingConflicts ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                Auto-resolve Conflicts ({conflictedEntries.length}) <ChevronDown className="h-3 w-3 ml-1" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 bg-card border-border text-muted-foreground">
                            <DropdownMenuItem onClick={() => onAutoResolveConflicts('room')} className="cursor-pointer hover:bg-muted focus:bg-muted focus:text-foreground">
                                Change Room Only
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAutoResolveConflicts('time')} className="cursor-pointer hover:bg-muted focus:bg-muted focus:text-foreground">
                                Change Time Only
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAutoResolveConflicts('both')} className="cursor-pointer hover:bg-muted focus:bg-muted focus:text-foreground">
                                Change Both (Any Available)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
            <div className="flex items-center gap-2">
                {filterMode === 'validation' ? (
                    <>
                        {(
                            [
                                { key: '', label: 'All', count: validationCounts.total },
                                { key: 'valid', label: 'Valid', count: validationCounts.valid },
                                { key: 'warning', label: 'Warnings', count: validationCounts.warnings },
                                { key: 'conflict', label: 'Conflicts', count: validationCounts.conflicts },
                            ] as const
                        ).map(({ key, label, count }) => (
                            <button
                                key={key}
                                onClick={() => setFilterStatus(key)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all',
                                    filterStatus === key
                                        ? 'bg-blue-600 text-white'
                                        : 'text-muted-foreground hover:bg-muted'
                                )}
                            >
                                {label}
                                {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
                            </button>
                        ))}
                    </>
                ) : (
                    <>
                        {['', 'pending_review', 'academic_head_approved', 'academic_head_flagged', 'academic_head_rejected'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors border',
                                    filterStatus === status
                                        ? 'bg-ah-sti-cyan/20 text-ah-sti-cyan border-ah-sti-cyan/30'
                                        : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
                                )}
                            >
                                {status ? REVIEW_STATUS_CONFIG[status]?.label ?? status : 'All'}
                            </button>
                        ))}
                        {counts.published > 0 && (
                            <button
                                onClick={() => setFilterStatus('published')}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors border',
                                    filterStatus === 'published'
                                        ? 'bg-blue-500/20 text-blue-500 dark:text-blue-400 border-blue-500/30'
                                        : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
                                )}
                            >
                                Published
                            </button>
                        )}
                        {failedPublishRows.size > 0 && (
                            <button
                                onClick={() => setFilterStatus('publish_failed')}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors border flex items-center gap-1.5',
                                    filterStatus === 'publish_failed'
                                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-500 border-amber-500/30'
                                        : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
                                )}
                            >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Failed Publish ({entries.filter(e => !e.is_published).length})
                            </button>
                        )}
                    </>
                )}
            </div>

            {selected.size > 0 && !hasPublishedSelected && canPublish && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                    <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        className="px-3 py-1.5 bg-background border border-input rounded-md text-xs text-foreground placeholder:text-muted-foreground outline-none w-48"
                    />
                    <button
                        onClick={() => onBatchAction('academic_head_approved')}
                        disabled={actionLoading || hasConflictSelected}
                        title={hasConflictSelected ? 'Cannot approve entries with conflicts' : undefined}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-md text-xs font-medium border border-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check className="h-3 w-3" /> Approve
                    </button>
                    <button
                        onClick={() => onBatchAction('academic_head_flagged')}
                        disabled={actionLoading}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-md text-xs font-medium border border-amber-500/30 transition-colors disabled:opacity-50"
                    >
                        <Flag className="h-3 w-3" /> Flag
                    </button>
                    <button
                        onClick={() => onBatchAction('academic_head_rejected')}
                        disabled={actionLoading}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-md text-xs font-medium border border-red-500/30 transition-colors disabled:opacity-50"
                    >
                        <X className="h-3 w-3" /> Reject
                    </button>
                    <div className="w-px h-5 bg-white/10" />
                    <button
                        onClick={onApproveAndPublish}
                        disabled={actionLoading || publishing || hasConflictSelected}
                        title={hasConflictSelected ? 'Cannot publish entries with conflicts' : undefined}
                        className="flex items-center gap-1 px-3 py-1.5 bg-ah-sti-cyan/20 hover:bg-ah-sti-cyan/30 text-ah-sti-cyan rounded-md text-xs font-medium border border-ah-sti-cyan/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                        Approve & Publish
                    </button>
                </div>
            )}
            {selected.size > 0 && hasPublishedSelected && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                    <button
                        onClick={onBatchRollback}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 rounded-md text-xs font-medium border border-amber-500/30 transition-colors disabled:opacity-50"
                    >
                        <RotateCcw className="h-3 w-3" /> Rollback Selected
                    </button>
                </div>
            )}
        </div>
    )
}
