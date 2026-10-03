'use client'

import {
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Loader2,
    Edit3,
    RotateCcw,
    Sparkles,
    Trash2,
    Clock,
    Flag,
    Inbox,
    SearchX,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { cn } from '@/lib/utils'
import { SessionTypePill } from '@/lib/schedule/sessionType'
import type { ScheduleStagingEntry } from '@/hooks/academic-head/useScheduleUploads'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type IconType = ComponentType<SVGProps<SVGSVGElement>>

const REVIEW_STATUS_CONFIG: Record<string, { label: string; color: string; icon: IconType }> = {
    pending_review: { label: 'Pending', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20', icon: Clock },
    academic_head_approved: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20', icon: CheckCircle2 },
    academic_head_flagged: { label: 'Flagged', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20', icon: Flag },
    academic_head_rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20', icon: XCircle },
}

interface ScheduleEntriesTableProps {
    loading: boolean
    filtered: ScheduleStagingEntry[]
    /** Total entries in the upload (before filtering) — drives the empty-state copy. */
    totalEntries?: number
    /** Whether a status filter is currently narrowing the list. */
    filterActive?: boolean
    selected: Set<string>
    failedPublishRows: Set<number>
    autoFixing: string | null
    autoFixingAll: boolean
    autoFixErrors: Record<string, string>
    uploadId: string
    onSelectAll: () => void
    onToggleSelect: (id: string) => void
    onEdit: (entry: ScheduleStagingEntry) => void
    onViewConflict: (entry: ScheduleStagingEntry) => void
    onAutoFix: (entryId: string) => void
    onDelete: (entry: ScheduleStagingEntry) => void
    onRollback: (entry: ScheduleStagingEntry) => void
    refetch: () => void
}

// ── Shared derived helpers (single source of truth for table + cards) ──────────

type Entry = ScheduleStagingEntry

function hasIssue(entry: Entry) {
    return entry.validation_status === 'error' || entry.has_internal_conflict || entry.has_external_conflict
}

function FacilityBlock({
    entry, autoFixing, autoFixingAll, autoFixErrors, onAutoFix,
}: {
    entry: Entry
    autoFixing: string | null
    autoFixingAll: boolean
    autoFixErrors: Record<string, string>
    onAutoFix: (entryId: string) => void
}) {
    const conf = entry.facility_match_confidence
    return (
        <div className="flex items-center gap-1 flex-wrap">
            <span className={cn('text-muted-foreground', !entry.facility_id && 'text-red-500 dark:text-red-300')}>
                {entry.facilities?.name ?? entry.facility_name_raw ?? '—'}
            </span>
            {entry.facility_id && conf !== null && conf > 0 && conf < 1 && (
                <span className="text-[11px] text-amber-500 dark:text-amber-300">({Math.round(conf * 100)}%)</span>
            )}
            {!entry.facility_id && (
                <span className="text-[11px] text-red-500 dark:text-red-300 bg-red-500/10 dark:bg-red-400/10 px-1.5 py-0.5 rounded">unmatched</span>
            )}
            {!entry.is_published && (!entry.facility_id || (conf !== null && conf < 0.8)) && (
                <button
                    type="button"
                    onClick={() => onAutoFix(entry.id)}
                    disabled={autoFixing === entry.id || autoFixingAll}
                    aria-label="Auto-assign best available facility"
                    title="Auto-assign best available facility"
                    className="p-1 rounded text-ah-sti-cyan hover:bg-ah-sti-cyan/10 transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ah-sti-cyan/50"
                >
                    {autoFixing === entry.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Sparkles className="h-3.5 w-3.5" />}
                </button>
            )}
            {autoFixErrors[entry.id] && (
                <span className="text-[11px] text-red-300 block w-full">{autoFixErrors[entry.id]}</span>
            )}
        </div>
    )
}

function ValidationCell({
    entry, failedPublishRows, onViewConflict,
}: {
    entry: Entry
    failedPublishRows: Set<number>
    onViewConflict: (entry: Entry) => void
}) {
    const renderValidationMessage = () => {
        if (entry.validation_status === 'warning' && entry.validation_warnings?.length) {
            return (
                <div className="flex flex-col gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 max-w-[200px] leading-tight mt-1">
                    {entry.validation_warnings.map((w: any, i: number) => (
                        <span key={i}>• {w.message}</span>
                    ))}
                </div>
            )
        }
        if (entry.validation_status === 'error' && entry.validation_errors?.length) {
            return (
                <div className="flex flex-col gap-0.5 text-[10px] text-red-600 dark:text-red-400 max-w-[200px] leading-tight mt-1">
                    {entry.validation_errors.map((e: any, i: number) => (
                        <span key={i}>• {e.message}</span>
                    ))}
                </div>
            )
        }
        return null;
    }

    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
                {entry.row_number !== null && failedPublishRows.has(entry.row_number) && (
                    <span title="Publish failed due to overlap" className="bg-amber-500/10 p-0.5 rounded cursor-help">
                        <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" aria-label="Publish failed due to overlap" />
                    </span>
                )}
                {entry.validation_status === 'pending' ? (
                    <span title="Pending validation" className="inline-flex">
                        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" aria-label="Pending validation" />
                    </span>
                ) : entry.validation_status === 'valid' ? (
                    // Only show the green checkmark if there are NO conflicts at all.
                    !(entry.has_internal_conflict || entry.has_external_conflict) && (
                        <span title="Valid" className="inline-flex">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="Valid" />
                        </span>
                    )
                ) : entry.validation_status === 'warning' ? (
                    <span className="inline-flex">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-label="Warning" />
                    </span>
                ) : (
                    <span className="inline-flex">
                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" aria-label="Validation error" />
                    </span>
                )}
                {(entry.has_internal_conflict || entry.has_external_conflict) && (
                    <button
                        type="button"
                        title={[
                            entry.has_internal_conflict ? 'Internal overlap (same upload)' : '',
                            entry.has_external_conflict ? 'Conflicts with live schedule' : '',
                        ].filter(Boolean).join(', ')}
                        aria-label="View conflict details"
                        className={cn(
                            "p-0.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2",
                            entry.has_external_conflict 
                                ? "bg-red-500/10 hover:bg-red-500/20 focus-visible:ring-red-400/50" 
                                : "bg-orange-500/10 hover:bg-orange-500/20 focus-visible:ring-orange-400/50"
                        )}
                        onClick={() => onViewConflict(entry)}
                    >
                        <AlertTriangle className={cn(
                            "h-3.5 w-3.5",
                            entry.has_external_conflict ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"
                        )} />
                    </button>
                )}
            </div>
            {renderValidationMessage()}
        </div>
    )
}

function ReviewBadge({ entry }: { entry: Entry }) {
    if (entry.is_published) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20">
                <CheckCircle2 className="h-3 w-3" />
                Published
            </span>
        )
    }
    const reviewInfo = REVIEW_STATUS_CONFIG[entry.academic_head_review_status] ?? REVIEW_STATUS_CONFIG.pending_review
    const ReviewIcon = reviewInfo.icon
    return (
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border', reviewInfo.color)}>
            <ReviewIcon className="h-3 w-3" />
            {reviewInfo.label}
        </span>
    )
}

function ActionButtons({
    entry, onEdit, onViewConflict, onDelete, onRollback, className,
}: {
    entry: Entry
    onEdit: (entry: Entry) => void
    onViewConflict: (entry: Entry) => void
    onDelete: (entry: Entry) => void
    onRollback: (entry: Entry) => void
    className?: string
}) {
    const btn = 'p-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2'
    const hasConflict = entry.has_internal_conflict || entry.has_external_conflict
    return (
        <div className={cn('flex items-center gap-1', className)}>
            {hasConflict && !entry.is_published && (
                <button
                    type="button" onClick={() => onViewConflict(entry)}
                    aria-label="View conflicts" title="View conflicts"
                    className={cn(
                        btn, 
                        entry.has_external_conflict 
                            ? 'text-red-500 dark:text-red-400 hover:bg-red-500/10 focus-visible:ring-red-400/50' 
                            : 'text-orange-400 hover:bg-orange-500/10 focus-visible:ring-orange-400/50'
                    )}
                >
                    <AlertTriangle className="h-4 w-4" />
                </button>
            )}
            {!entry.is_published && (
                <>
                    <button
                        type="button" onClick={() => onEdit(entry)}
                        aria-label="Edit entry" title="Edit entry"
                        className={cn(btn, 'text-blue-500 dark:text-blue-300 hover:bg-blue-500/10 focus-visible:ring-blue-400/50')}
                    >
                        <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                        type="button" onClick={() => onDelete(entry)}
                        aria-label="Delete entry" title="Delete entry"
                        className={cn(btn, 'text-red-500 dark:text-red-300 hover:bg-red-500/10 focus-visible:ring-red-400/50')}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </>
            )}
            {entry.is_published && (
                <button
                    type="button" onClick={() => onRollback(entry)}
                    aria-label="Rollback entry" title="Rollback entry"
                    className={cn(btn, 'text-amber-400 hover:bg-amber-500/10 focus-visible:ring-amber-400/50')}
                >
                    <RotateCcw className="h-4 w-4" />
                </button>
            )}
        </div>
    )
}

// ── Empty + loading ────────────────────────────────────────────────────────────

function LoadingSkeleton() {
    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden" aria-busy="true" aria-label="Loading entries">
            <div className="divide-y divide-border">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3.5">
                        <div className="h-4 w-4 rounded bg-muted motion-safe:animate-pulse" />
                        <div className="h-3.5 w-28 rounded bg-muted motion-safe:animate-pulse" />
                        <div className="hidden sm:block h-3.5 w-16 rounded bg-muted motion-safe:animate-pulse" />
                        <div className="hidden md:block h-3.5 w-24 rounded bg-muted motion-safe:animate-pulse" />
                        <div className="hidden lg:block h-3.5 w-20 rounded bg-muted motion-safe:animate-pulse" />
                        <div className="ml-auto h-3.5 w-16 rounded-full bg-muted motion-safe:animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    )
}

function EmptyState({ totalEntries, filterActive }: { totalEntries?: number; filterActive?: boolean }) {
    const filteredOut = filterActive && (totalEntries ?? 0) > 0
    const Icon = filteredOut ? SearchX : Inbox
    const title = filteredOut ? 'No entries match this filter' : 'No entries in this upload yet'
    const hint = filteredOut
        ? 'Clear or change the active filter to see the rest of the rows.'
        : 'Once a schedule file is parsed, its rows will appear here for review.'
    return (
        <div className="bg-card border border-border rounded-xl py-16 px-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted border border-border">
                <Icon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p>
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ScheduleEntriesTable(props: ScheduleEntriesTableProps) {
    const {
        loading, filtered, totalEntries, filterActive, selected, failedPublishRows,
        autoFixing, autoFixingAll, autoFixErrors,
        onSelectAll, onToggleSelect, onEdit, onViewConflict, onAutoFix, onDelete, onRollback,
    } = props

    if (loading) return <LoadingSkeleton />
    if (filtered.length === 0) return <EmptyState totalEntries={totalEntries} filterActive={filterActive} />

    const allSelected = selected.size === filtered.length && filtered.length > 0

    return (
        <>
            {/* Desktop / tablet: dense table */}
            <div className="hidden md:block bg-card border border-border rounded-b-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                <th scope="col" className="p-3 text-left">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={onSelectAll}
                                        aria-label="Select all entries"
                                        className="rounded border-input"
                                    />
                                </th>
                                <th scope="col" className="p-3 text-left text-muted-foreground font-medium">Row</th>
                                <th scope="col" className="p-3 text-left text-muted-foreground font-medium">Course</th>
                                <th scope="col" className="p-3 text-left text-muted-foreground font-medium">Section</th>
                                <th scope="col" className="p-3 text-left text-muted-foreground font-medium">Room</th>
                                <th scope="col" className="p-3 text-left text-muted-foreground font-medium">Instructor</th>
                                <th scope="col" className="p-3 text-left text-muted-foreground font-medium">Day</th>
                                <th scope="col" className="p-3 text-left text-muted-foreground font-medium">Time</th>
                                <th scope="col" className="p-3 text-left text-muted-foreground font-medium">Validation</th>
                                <th scope="col" className="p-3 text-left text-muted-foreground font-medium">Review</th>
                                <th scope="col" className="p-3 text-right text-muted-foreground font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filtered.map(entry => {
                                const isSelected = selected.has(entry.id)
                                return (
                                    <tr
                                        key={entry.id}
                                        className={cn(
                                            'transition-colors hover:bg-muted/50',
                                            hasIssue(entry) && 'bg-red-500/[0.04]',
                                            isSelected && 'bg-ah-sti-cyan/[0.07] hover:bg-ah-sti-cyan/10',
                                        )}
                                    >
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => onToggleSelect(entry.id)}
                                                aria-label={`Select ${entry.course_code} ${entry.section}`}
                                                className="rounded border-input"
                                            />
                                        </td>
                                        <td className="p-3 text-muted-foreground">{entry.row_number ?? '—'}</td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-foreground font-medium">{entry.course_code}</span>
                                                <SessionTypePill value={entry.session_type} />
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px] truncate" title={entry.course_name}>
                                                {entry.course_name}
                                            </div>
                                        </td>
                                        <td className="p-3 text-muted-foreground">{entry.section}</td>
                                        <td className="p-3">
                                            <FacilityBlock
                                                entry={entry} autoFixing={autoFixing} autoFixingAll={autoFixingAll}
                                                autoFixErrors={autoFixErrors} onAutoFix={onAutoFix}
                                            />
                                        </td>
                                        <td className="p-3 text-muted-foreground">{entry.instructor_name}</td>
                                        <td className="p-3 text-muted-foreground">{DAY_NAMES[entry.day_of_week] ?? '?'}</td>
                                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                                            {entry.start_time?.slice(0, 5)} – {entry.end_time?.slice(0, 5)}
                                        </td>
                                        <td className="p-3">
                                            <ValidationCell entry={entry} failedPublishRows={failedPublishRows} onViewConflict={onViewConflict} />
                                        </td>
                                        <td className="p-3"><ReviewBadge entry={entry} /></td>
                                        <td className="p-3">
                                            <ActionButtons
                                                entry={entry} onEdit={onEdit} onViewConflict={onViewConflict}
                                                onDelete={onDelete} onRollback={onRollback} className="justify-end"
                                            />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile: stacked cards */}
            <div className="md:hidden space-y-3">
                {filtered.map(entry => {
                    const isSelected = selected.has(entry.id)
                    return (
                        <div
                            key={entry.id}
                            className={cn(
                                'rounded-xl border p-4 transition-colors bg-card',
                                hasIssue(entry) && 'border-red-500/30 bg-red-500/[0.04]',
                                isSelected && 'border-ah-sti-cyan/40 bg-ah-sti-cyan/[0.07]',
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => onToggleSelect(entry.id)}
                                    aria-label={`Select ${entry.course_code} ${entry.section}`}
                                    className="mt-1 h-4 w-4 rounded border-input"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-sm font-semibold text-foreground">{entry.course_code}</span>
                                        <SessionTypePill value={entry.session_type} />
                                        <span className="text-xs text-muted-foreground">· {entry.section}</span>
                                    </div>
                                    {entry.course_name && (
                                        <p className="mt-0.5 text-xs text-muted-foreground truncate" title={entry.course_name}>{entry.course_name}</p>
                                    )}
                                </div>
                                <ValidationCell entry={entry} failedPublishRows={failedPublishRows} onViewConflict={onViewConflict} />
                            </div>

                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                <div>
                                    <dt className="text-muted-foreground">Room</dt>
                                    <dd className="mt-0.5">
                                        <FacilityBlock
                                            entry={entry} autoFixing={autoFixing} autoFixingAll={autoFixingAll}
                                            autoFixErrors={autoFixErrors} onAutoFix={onAutoFix}
                                        />
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Instructor</dt>
                                    <dd className="mt-0.5 text-muted-foreground truncate">{entry.instructor_name || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Day & time</dt>
                                    <dd className="mt-0.5 text-muted-foreground">
                                        {DAY_NAMES[entry.day_of_week] ?? '?'} · {entry.start_time?.slice(0, 5)} – {entry.end_time?.slice(0, 5)}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Row</dt>
                                    <dd className="mt-0.5 text-muted-foreground">{entry.row_number ?? '—'}</dd>
                                </div>
                            </dl>

                            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                                <ReviewBadge entry={entry} />
                                <ActionButtons
                                    entry={entry} onEdit={onEdit} onViewConflict={onViewConflict}
                                    onDelete={onDelete} onRollback={onRollback}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        </>
    )
}
