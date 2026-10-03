'use client'

/**
 * Schedule Review Queue — Academic Head
 * Shows submissions pending review.
 * Redirects to the Uploads page with status=submitted filter.
 */

import { useState, useMemo, useEffect } from 'react'

export default function ReviewQueuePage() {
    return <ScheduleReviewDashboard />
}

// ── Inline Review Dashboard ──────────────────────────────
import { useScheduleUploads } from '@/hooks/academic-head/useScheduleUploads'
import {
    Clock,
    CheckCircle2,
    AlertTriangle,
    ChevronRight,
    FileSpreadsheet,
    Eye,
    FileEdit,
    Trash2,
    Loader2,
    X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadStatusLabel } from '@/lib/enum-labels'
import Link from 'next/link'
import { ROUTES } from '@/lib/routes'
import { SkeletonList } from "@/components/ui/SkeletonList";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'


function ScheduleReviewDashboard() {
    const { uploads, loading, refetch } = useScheduleUploads({ status: ['submitted', 'pending_submission'] })
    const [changeRequestCount, setChangeRequestCount] = useState(0)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [confirmAction, setConfirmAction] = useState<{ id: string; label: string } | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    const handleDelete = async (uploadId: string) => {
        setDeleting(uploadId)
        setDeleteError(null)
        try {
            const res = await fetch(`/api/schedules/uploads/${uploadId}`, { method: 'DELETE' })
            if (res.ok) refetch()
            else setDeleteError((await res.json()).error ?? 'Delete failed')
        } catch { setDeleteError('Delete failed — please try again.') }
        setDeleting(null)
    }

    // Fetch pending change request count
    useEffect(() => {
        fetch('/api/schedules/change-requests/review')
            .then(r => r.json())
            .then(data => setChangeRequestCount(data.change_requests?.length ?? 0))
            .catch(() => {})
    }, [])

    // Also get recently reviewed
    const { uploads: recentlyReviewed } = useScheduleUploads()

    const reviewed = useMemo(() =>
        (recentlyReviewed ?? [])
            .filter(u => ['approved', 'rejected', 'revision_requested'].includes(u.upload_status))
            .slice(0, 5),
        [recentlyReviewed]
    )

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#060A11] transition-colors duration-300">
            <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-12">
                
                {/* Updated Header Section - Console Style */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">
                            Review <span className="text-accent-brand">Queue</span>
                        </h1>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                            Schedule submissions awaiting academic review
                        </p>
                    </div>
                </div>

                {/* Change requests banner */}
                {changeRequestCount > 0 && (
                    <Link
                        href={ROUTES.academic.schedulesChangeRequests}
                        className="group flex items-center gap-5 bg-white/60 dark:bg-amber-500/5 hover:bg-white dark:hover:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-3xl p-5 sm:p-6 transition-all shadow-sm backdrop-blur-sm"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <FileEdit className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <p className="text-xs sm:text-sm font-black uppercase tracking-tight text-amber-700 dark:text-amber-300 leading-none">
                                {changeRequestCount} pending schedule change request{changeRequestCount !== 1 ? 's' : ''}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wide">
                                Program heads have submitted modifications for your review
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100/50 dark:bg-amber-500/10 group-hover:translate-x-1 transition-transform">
                            <ChevronRight className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                        </div>
                    </Link>
                )}

                {/* Delete error inline banner */}
                {deleteError && (
                    <div className="flex items-center gap-3 p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl text-xs font-semibold text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{deleteError}</span>
                        <button onClick={() => setDeleteError(null)} className="text-rose-400 hover:text-rose-600 transition-colors"><X className="h-3.5 w-3.5" /></button>
                    </div>
                )}

                {/* Pending for review Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                        <Clock className="w-5 h-5 text-blue-500" />
                        <h2 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">
                            Pending Review ({uploads.length})
                        </h2>
                    </div>

                    {loading ? (
                        <SkeletonList />
                    ) : uploads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center px-8 bg-white/20 dark:bg-slate-900/5 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800/50">
                            <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center mb-5 shadow-sm border border-slate-100 dark:border-slate-800">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">Queue is Empty</h3>
                            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 max-w-[240px] leading-relaxed">
                                All submitted schedules have been processed.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {uploads.map(upload => (
                                <div key={upload.id} className="relative group">
                                    <Link
                                        href={`/academic/schedules/review/${upload.id}`}
                                        className="flex flex-col sm:flex-row sm:items-center gap-5 bg-white dark:bg-[#0B0F17] p-5 sm:p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all duration-300"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center shadow-inner shrink-0 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                                            <FileSpreadsheet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                        </div>

                                        <div className="flex-1 min-w-0 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[15px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate leading-none">
                                                    {upload.departments?.name}
                                                </span>
                                                <div className="flex gap-1.5">
                                                    <Badge className="bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/10 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                                                        {upload.total_entries} entries
                                                    </Badge>
                                                    {upload.conflict_count > 0 && (
                                                        <Badge className="bg-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/10 text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                                                            <AlertTriangle className="h-2.5 w-2.5" />
                                                            {upload.conflict_count} conflicts
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                                <span className="flex items-center gap-1">BY <span className="text-slate-600 dark:text-slate-300">{upload.users?.full_name}</span></span>
                                                <span className="opacity-30">•</span>
                                                <span className="truncate max-w-[150px]">{upload.source_file_name ?? 'Manual Entry'}</span>
                                                <span className="opacity-30">•</span>
                                                <span>{upload.submitted_at ? new Date(upload.submitted_at).toLocaleDateString() : 'N/A'}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 justify-end border-t sm:border-t-0 border-slate-50 dark:border-slate-900 pt-4 sm:pt-0">
                                            <button
                                                onClick={e => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    setConfirmAction({ id: upload.id, label: `Delete upload from ${upload.departments?.name}?` })
                                                }}
                                                disabled={deleting === upload.id}
                                                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all disabled:opacity-40"
                                            >
                                                {deleting === upload.id
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <Trash2 className="h-4 w-4" />
                                                }
                                            </button>
                                            <div className="flex items-center gap-2 group/btn py-2.5 px-5 rounded-xl bg-slate-900 dark:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10">
                                                Review
                                                <ChevronRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-1" />
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Recently reviewed Section */}
                {reviewed.length > 0 && (
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 px-1">
                            <Eye className="w-5 h-5 text-slate-400" />
                            <h2 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">
                                Recently Reviewed
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                            {reviewed.map(upload => {
                                const statusColors: Record<string, string> = {
                                    approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                                    rejected: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                                    revision_requested: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                                }
                                return (
                                    <Link
                                        key={upload.id}
                                        href={`/academic/schedules/review/${upload.id}`}
                                        className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white/50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/50 rounded-2xl p-4 hover:bg-white dark:hover:bg-slate-900/40 transition-all duration-300"
                                    >
                                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 w-24 uppercase">
                                            {upload.reviewed_at ? new Date(upload.reviewed_at).toLocaleDateString() : '—'}
                                        </span>
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex-1 truncate uppercase tracking-tight">
                                            {upload.departments?.name} <span className="opacity-40 px-2">—</span> {upload.source_file_name ?? 'Manual'}
                                        </span>
                                        <Badge className={cn('text-[9px] font-black uppercase tracking-tighter px-3 py-1 border-none rounded-lg shrink-0 self-start sm:self-center', statusColors[upload.upload_status] ?? 'bg-slate-100 text-slate-500')}>
                                            {uploadStatusLabel(upload.upload_status)}
                                        </Badge>
                                    </Link>
                                )
                            })}
                        </div>
                    </section>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            {confirmAction && (
                <AlertDialog open onOpenChange={(o) => { if (!o) setConfirmAction(null) }}>
                    <AlertDialogContent className="max-w-md p-8 sm:p-10 bg-white dark:bg-[#0B0F17] border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
                        <AlertDialogHeader className="flex-row items-center gap-4 space-y-0 mb-2 text-left">
                            <div className="p-3 bg-rose-500/10 rounded-2xl">
                                <Trash2 className="h-6 w-6 text-rose-500" />
                            </div>
                            <AlertDialogTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Delete Upload</AlertDialogTitle>
                        </AlertDialogHeader>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed mb-10">
                            {confirmAction.label} This cannot be undone and all associated entries will be permanently removed.
                        </p>
                        <AlertDialogFooter className="flex-col sm:flex-row items-center justify-end gap-3">
                            <AlertDialogCancel
                                onClick={() => setConfirmAction(null)}
                                className="w-full sm:w-auto m-0 px-6 h-12 bg-transparent border-transparent text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-transparent dark:hover:bg-transparent transition-colors"
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={async (e) => {
                                    e.preventDefault()
                                    const id = confirmAction.id
                                    setConfirmAction(null)
                                    await handleDelete(id)
                                }}
                                className="w-full sm:w-auto px-10 h-12 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-rose-500/20 active:scale-95"
                            >
                                Delete Forever
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    )
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <span className={cn(
            "inline-flex items-center border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            className
        )}>
            {children}
        </span>
    )
}