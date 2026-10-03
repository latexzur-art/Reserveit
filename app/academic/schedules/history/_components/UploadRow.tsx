'use client'

import { useState } from 'react'
import {
    FileSpreadsheet,
    ChevronDown,
    RotateCcw,
    Trash2,
    Loader2,
    CheckSquare,
    Square,
    ArrowRight,
    ArrowRightCircle,
    CheckCircle2,
    AlertTriangle,
    FileEdit,
    Clock,
    RotateCw,
    XCircle,
    Check,
    Zap,
    X,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { uploadStatusLabel } from '@/lib/enum-labels'
import { ROUTES } from '@/lib/routes'

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    parsing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    validation_failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    pending_submission: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    submitted: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    revision_requested: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
}

/** Derive a "health" badge from upload state + entry counts */
export function getHealthBadge(upload: any): { label: string; icon: typeof CheckCircle2; style: string; tooltip: string } {
    const conflicts = upload.conflict_count ?? 0
    const errors = upload.error_entries_count ?? 0
    const status = upload.upload_status

    // Build tooltip parts
    const parts: string[] = []
    if (conflicts > 0) parts.push(`${conflicts} Conflict${conflicts > 1 ? 's' : ''}`)
    if (errors > 0) parts.push(`${errors} Error${errors > 1 ? 's' : ''}`)
    const tooltip = parts.length > 0 ? parts.join(', ') : ''

    if (status === 'approved' && conflicts === 0 && errors === 0) {
        return { label: 'Validated', icon: CheckCircle2, style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', tooltip: 'All entries validated and published' }
    }
    if ((status === 'partially_approved' || conflicts > 0) && status !== 'rejected') {
        return { label: 'Conflict Found', icon: AlertTriangle, style: 'bg-orange-500/10 text-orange-400 border-orange-500/20', tooltip }
    }
    if (status === 'draft' || status === 'pending_submission') {
        return { label: 'Draft', icon: FileEdit, style: 'bg-slate-500/10 text-slate-400 border-slate-500/20', tooltip: 'Saved but not yet submitted' }
    }
    if (status === 'parsing' || status === 'submitted') {
        return { label: 'Processing', icon: Clock, style: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', tooltip: 'Upload is being processed' }
    }
    if (status === 'revision_requested') {
        return { label: 'Revision', icon: RotateCw, style: 'bg-orange-500/10 text-orange-400 border-orange-500/20', tooltip: 'Revision requested by reviewer' }
    }
    if (status === 'validation_failed' || status === 'rejected') {
        return { label: 'Failed', icon: XCircle, style: 'bg-red-500/10 text-red-400 border-red-500/20', tooltip: tooltip || 'Validation failed or rejected' }
    }
    return { label: uploadStatusLabel(status), icon: FileEdit, style: STATUS_STYLES[status] ?? STATUS_STYLES.draft, tooltip }
}

/** Stacked bar with clear textual breakdown for valid/warning/error/conflict entries */
export function HealthBar({ upload }: { upload: any }) {
    const total = upload.total_entries ?? 0
    if (total === 0) return null

    const valid = upload.valid_entries_count ?? 0
    const warnings = upload.warning_entries_count ?? 0
    const errors = upload.error_entries_count ?? 0
    const conflicts = upload.conflict_count ?? 0
    const pending = Math.max(0, total - valid - warnings - errors)

    const segments = [
        { count: valid, color: 'bg-emerald-500', label: 'Valid' },
        { count: warnings, color: 'bg-amber-500', label: 'Warnings' },
        { count: errors, color: 'bg-rose-500', label: 'Errors' },
        { count: pending, color: 'bg-slate-500', label: 'Pending' },
    ].filter(s => s.count > 0)

    const tooltipText = segments.map(s => `${s.count} ${s.label}`).join(', ')
        + (conflicts > 0 ? ` • ${conflicts} Conflict${conflicts > 1 ? 's' : ''}` : '')

    return (
        <div className="space-y-1 mt-1.5" title={tooltipText}>
            {/* Visual Segmented Progress Bar */}
            <div className="flex w-full h-1.5 rounded-full overflow-hidden gap-px bg-slate-100 dark:bg-white/5">
                {segments.map((seg, i) => (
                    <div
                        key={i}
                        className={cn('h-full rounded-full', seg.color)}
                        style={{ width: `${(seg.count / total) * 100}%`, minWidth: seg.count > 0 ? '3px' : '0' }}
                    />
                ))}
            </div>

            {/* Clear Textual Breakdown with Icons */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium leading-tight">
                {valid > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                        <Check className="w-4 h-4 text-green-500 font-bold" /> {valid} valid
                    </span>
                )}
                {warnings > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5 font-semibold">
                        <AlertTriangle className="w-4 h-4 text-amber-500" /> {warnings} warning{warnings > 1 ? 's' : ''}
                    </span>
                )}
                {conflicts > 0 && (
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5 font-semibold">
                        <Zap className="w-4 h-4 text-orange-500" /> {conflicts} conflict{conflicts > 1 ? 's' : ''}
                    </span>
                )}
                {errors > 0 && (
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5 font-semibold">
                        <X className="w-4 h-4 text-red-500" /> {errors} error{errors > 1 ? 's' : ''}
                    </span>
                )}
            </div>
        </div>
    )
}

// ── Component: UploadRow ──

export function UploadRow({
    upload,
    onSetConfirmAction,
    isSelected,
    onToggleSelect,
}: {
    upload: any;
    onSetConfirmAction: (action: any) => void;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [loadingDetails, setLoadingDetails] = useState(false)
    const [stats, setStats] = useState<{ published: number, failed: number, pending: number } | null>(null)

    // Fetch live details from DB when expanded
    const expandRow = async () => {
        setIsExpanded(!isExpanded)
        if (!isExpanded && !stats) {
            setLoadingDetails(true)
            try {
                const { createClient } = await import('@/lib/supabase/client')
                const supabase = createClient()
                const { data, error } = await supabase
                    .from('schedule_entries_staging')
                    .select('academic_head_review_status, academic_head_review_notes, is_published, validation_status, row_number')
                    .eq('schedule_upload_id', upload.id)

                if (!error && data) {
                    let published = 0
                    let failed = 0
                    let pending = 0

                    data.forEach(e => {
                        if (e.is_published) published++
                        else if (e.academic_head_review_status === 'academic_head_flagged' && e.academic_head_review_notes?.includes('Failed to publish') && e.row_number !== null) failed++
                        else pending++
                    })
                    setStats({ published, failed, pending })
                }
            } catch (err) { }
            setLoadingDetails(false)
        }
    }

    return (
        <>
            <tr className={cn("border-b border-slate-100 dark:border-white/5 transition-colors group", isSelected ? "bg-ah-sti-cyan/5" : "hover:bg-slate-100 dark:hover:bg-white/[0.02]")}>
                <td className="px-5 py-4 w-8">
                    <button onClick={() => onToggleSelect(upload.id)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                        {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-ah-sti-cyan" />
                        ) : (
                            <Square className="h-4 w-4" />
                        )}
                    </button>
                </td>
                <td className="px-3 py-4 w-8">
                    <button
                        onClick={expandRow}
                        className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded ? "rotate-180 text-ah-sti-cyan" : "")} />
                    </button>
                </td>
                <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-300">
                    {new Date(upload.created_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-4">
                    <span className="text-sm text-slate-900 dark:text-white font-medium">
                        {upload.departments?.code ?? '—'}
                    </span>
                    <p className="text-xs text-slate-500">{upload.departments?.name}</p>
                </td>
                <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                            {upload.source_file_name ?? 'Manual Entry'}
                        </span>
                    </div>
                </td>
                <td className="px-5 py-4">
                    {(() => {
                        const badge = getHealthBadge(upload)
                        const BadgeIcon = badge.icon
                        return (
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-help',
                                    badge.style
                                )}
                                title={badge.tooltip}
                            >
                                <BadgeIcon className="h-2.5 w-2.5" />
                                {badge.label}
                            </span>
                        )
                    })()}
                </td>
                <td className="px-5 py-4">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{upload.total_entries}</span>
                    <HealthBar upload={upload} />
                </td>
                <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {upload.users?.full_name ?? '—'}
                </td>
                <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                        {['parsing', 'parsed', 'pending_submission', 'submitted', 'revision_requested', 'validation_failed'].includes(upload.upload_status) && (
                            <Link
                                href={`/academic/schedules/review/${upload.id}`}
                                className="p-1.5 rounded-md text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                                title="Review Upload"
                            >
                                <ArrowRightCircle className="h-4 w-4" />
                            </Link>
                        )}
                        {upload.upload_status === 'approved' && (
                            <button
                                onClick={() => onSetConfirmAction({ type: 'rollback', id: upload.id, label: `Rollback "${upload.source_file_name ?? 'Manual Entry'}"` })}
                                className="p-1.5 rounded-md text-amber-400 hover:bg-amber-500/10 transition-colors"
                                title="Rollback"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </button>
                        )}
                        <button
                            onClick={() => onSetConfirmAction({ type: 'delete-upload', id: upload.id, label: `Delete upload "${upload.source_file_name ?? 'Manual Entry'}"` })}
                            className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-slate-100 dark:bg-white/[0.01]">
                    <td colSpan={9} className="p-0 border-b border-slate-100 dark:border-white/5">
                        <div className="px-14 py-6">
                            <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2 flex items-center gap-2">
                                <FileSpreadsheet className="h-3.5 w-3.5 text-ah-sti-cyan" />
                                Upload Breakdown
                            </h4>

                            {loadingDetails ? (
                                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                                    <Loader2 className="h-4 w-4 animate-spin text-ah-sti-cyan" />
                                    Fetching live entry data...
                                </div>
                            ) : stats ? (
                                <div className="grid grid-cols-4 gap-4">
                                    <Link href={`/academic/schedules/review/${upload.id}`} className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-3 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors block">
                                        <p className="text-[10px] text-slate-500 mb-1">Total Uploaded</p>
                                        <p className="text-xl font-bold text-slate-900 dark:text-white">{upload.total_entries}</p>
                                    </Link>
                                    <Link href={`/academic/schedules/review/${upload.id}?filter=published`} className="bg-slate-100 dark:bg-white/5 border border-emerald-500/20 rounded-lg p-3 relative overflow-hidden hover:bg-slate-200 dark:hover:bg-white/10 transition-colors block">
                                        <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/10 blur-xl rounded-full translate-x-1/2 -translate-y-1/2" />
                                        <p className="text-[10px] text-emerald-500/80 mb-1">Published</p>
                                        <p className="text-xl font-bold text-emerald-400">{stats.published}</p>
                                    </Link>
                                    <Link href={`/academic/schedules/review/${upload.id}?filter=publish_failed`} className="bg-slate-100 dark:bg-white/5 border border-amber-500/20 rounded-lg p-3 relative overflow-hidden hover:bg-slate-200 dark:hover:bg-white/10 transition-colors block">
                                        <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/10 blur-xl rounded-full translate-x-1/2 -translate-y-1/2" />
                                        <p className="text-[10px] text-amber-500/80 mb-1">Failed (Overlaps)</p>
                                        <p className="text-xl font-bold text-amber-400">{stats.failed}</p>
                                    </Link>
                                    <Link href={`/academic/schedules/review/${upload.id}?filter=pending_review`} className="bg-slate-100 dark:bg-white/5 border border-cyan-500/20 rounded-lg p-3 relative overflow-hidden hover:bg-slate-200 dark:hover:bg-white/10 transition-colors block">
                                        <div className="absolute top-0 right-0 w-12 h-12 bg-cyan-500/10 blur-xl rounded-full translate-x-1/2 -translate-y-1/2" />
                                        <p className="text-[10px] text-cyan-500/80 mb-1">Pending / Unpub</p>
                                        <p className="text-xl font-bold text-cyan-400">{stats.pending}</p>
                                    </Link>
                                </div>
                            ) : (
                                <div className="text-sm text-red-400">Failed to load upload statistics.</div>
                            )}

                            <div className="mt-4 flex items-center justify-end gap-3">
                                <Link
                                    href={`/academic/schedules/review/${upload.id}`}
                                    className="text-xs bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-900 dark:text-white px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 font-medium"
                                >
                                    Open Review Page <ArrowRight className="h-3 w-3" />
                                </Link>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    )
}
