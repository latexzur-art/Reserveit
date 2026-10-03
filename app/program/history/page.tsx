'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { History, FileSpreadsheet, Clock, CheckCircle2, AlertTriangle, XCircle, ChevronRight, GraduationCap, CalendarDays, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurriculumManagement } from '@/hooks/academic-head/useCurriculumManagement'
import { useRefetchOnFocus } from '@/hooks/shared/useRefetchOnFocus'
import { BatchUploadList } from '@/components/curriculum/BatchUploadList'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import Link from 'next/link'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: 'Draft', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: FileSpreadsheet },
    parsing: { label: 'Parsing', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Clock },
    parsed: { label: 'Parsed', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20', icon: CheckCircle2 },
    pending_submission: { label: 'Ready to Submit', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Clock },
    submitted: { label: 'Pending Review', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Clock },
    revision_requested: { label: 'Returned', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: AlertTriangle },
    approved: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
    partially_approved: { label: 'Partial', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: AlertTriangle },
    rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
    validation_failed: { label: 'Failed', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
    deleted: { label: 'Deleted', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: XCircle },
}

export default function UploadHistoryPage() {
    const [activeTab, setActiveTab] = useState<'schedules' | 'curriculum'>('schedules')

    // ── SCHEDULE UPLOADS STATE ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [scheduleUploads, setScheduleUploads] = useState<any[]>([])
    const [schedulesLoading, setSchedulesLoading] = useState(true)

    const fetchScheduleUploads = useCallback(async () => {
        setSchedulesLoading(true)
        try {
            const res = await fetch('/api/schedules/uploads')
            const data = await res.json()
            setScheduleUploads(data.uploads ?? [])
        } catch {
            setScheduleUploads([])
        }
        setSchedulesLoading(false)
    }, [])

    useEffect(() => {
        // eslint-disable-next-line
        if (activeTab === 'schedules') fetchScheduleUploads()
    }, [activeTab, fetchScheduleUploads])

    // ── CURRICULUM UPLOADS STATE ──
    const {
        uploadHistory, uploadHistoryTotal, uploadHistoryLoading, fetchUploadHistory,
        submitBatch, deleteBatch, requestDeletion, clearHistory
    } = useCurriculumManagement()

    const [batchPage, setBatchPage] = useState(1)
    const [clearing, setClearing] = useState(false)

    const handleClearHistory = async () => {
        setClearing(true)
        const { cleared, error } = await clearHistory()
        setClearing(false)
        if (error) {
            toast.error(error)
            return
        }
        toast.success(cleared ? `Cleared ${cleared} upload${cleared === 1 ? '' : 's'} from history.` : 'No finished uploads to clear.')
        setBatchPage(1)
        fetchUploadHistory({ page: 1 })
    }

    useEffect(() => {
        if (activeTab === 'curriculum') fetchUploadHistory({ page: batchPage })
    }, [activeTab, batchPage, fetchUploadHistory])

    useRefetchOnFocus(() => {
        // eslint-disable-next-line
        if (activeTab === 'schedules') fetchScheduleUploads()
        else fetchUploadHistory({ page: batchPage })
    })

    return (
        <div className="min-h-screen bg-background">
            <ConnectedTopBar
                title="Upload History"
                breadcrumbs={[
                    { label: 'Dashboard', href: '/program/dashboard' },
                    { label: 'Upload History' },
                ]}
            />

            <main className="p-6 max-w-6xl mx-auto space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-sti-blue/10 rounded-xl">
                        <History className="h-6 w-6 text-sti-blue" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">UPLOAD <span className="text-accent-brand">HISTORY</span></h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Track the status of your uploaded schedules and curriculum batches.
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-border">
                    <button
                        onClick={() => setActiveTab('schedules')}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors",
                            activeTab === 'schedules'
                                ? "border-sti-blue text-sti-blue"
                                : "border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <CalendarDays className="h-4 w-4" />
                        Schedule Uploads
                    </button>
                    <button
                        onClick={() => setActiveTab('curriculum')}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors",
                            activeTab === 'curriculum'
                                ? "border-sti-blue text-sti-blue"
                                : "border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <GraduationCap className="h-4 w-4" />
                        Curriculum Uploads
                    </button>
                </div>

                {/* Tab Content */}
                <div className="pt-4">
                    {activeTab === 'schedules' && (
                        <div className="space-y-4">
                            {schedulesLoading ? (
                                <div className="space-y-4">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="border rounded-xl p-5 bg-card animate-pulse">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                                                        <div className="h-3 w-3 bg-slate-200 dark:bg-slate-800 rounded-full" />
                                                        <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                                                    </div>
                                                </div>
                                                <div className="hidden sm:flex gap-6">
                                                    <div className="space-y-2">
                                                        <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded" />
                                                        <div className="h-4 w-8 bg-slate-200 dark:bg-slate-800 rounded mx-auto" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded" />
                                                        <div className="h-4 w-8 bg-slate-200 dark:bg-slate-800 rounded mx-auto" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : scheduleUploads.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground border rounded-xl bg-white dark:bg-background">
                                    No schedule uploads found.
                                </div>
                            ) : (
                                scheduleUploads.map((upload) => {
                                    const statusInfo = STATUS_CONFIG[upload.upload_status] ?? STATUS_CONFIG.draft
                                    const StatusIcon = statusInfo.icon

                                    return (
                                        <div key={upload.id} className="group border hover:border-sti-blue/30 rounded-xl p-5 transition-all hover:bg-sti-blue/5 bg-card">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-sti-blue/10 flex items-center justify-center flex-shrink-0">
                                                    <FileSpreadsheet className="h-5 w-5 text-sti-blue" />
                                                </div>

                                                <Link
                                                    href={`/program/schedules/review/${upload.id}`}
                                                    className="flex-1 min-w-0"
                                                >
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="text-sm font-medium truncate text-slate-900 dark:text-white">
                                                            {upload.source_file_name ?? 'Manual Entry'}
                                                        </span>
                                                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border', statusInfo.color)}>
                                                            <StatusIcon className="h-3 w-3" />
                                                            {statusInfo.label}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                        <span>{upload.departments?.name ?? 'All Departments'}</span>
                                                        <span>•</span>
                                                        <span>{new Date(upload.created_at).toLocaleDateString()}</span>
                                                        {upload.users?.full_name && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{upload.users.full_name}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </Link>

                                                <div className="hidden sm:flex items-center gap-6 text-xs">
                                                    <div className="text-center">
                                                        <p className="text-muted-foreground mb-0.5">Entries</p>
                                                        <p className="font-semibold text-slate-900 dark:text-white">{upload.total_entries}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-muted-foreground mb-0.5">Valid</p>
                                                        <p className="text-emerald-600 font-semibold">{upload.valid_entries_count}</p>
                                                    </div>
                                                    {upload.error_entries_count > 0 && (
                                                        <div className="text-center">
                                                            <p className="text-muted-foreground mb-0.5">Errors</p>
                                                            <p className="text-red-600 dark:text-red-400 font-semibold">{upload.error_entries_count}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-sti-blue transition-colors" />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {activeTab === 'curriculum' && (
                        <div className="bg-card rounded-2xl border border-slate-200 dark:border-white/10 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs text-muted-foreground">
                                    Showing all your curriculum uploads, including approved, rejected, and returned batches.
                                </p>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <button
                                            disabled={clearing || uploadHistory.length === 0}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Clear History
                                        </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Clear upload history?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This permanently removes your finished curriculum uploads (approved, rejected, and returned batches) from this list.
                                                Approved courses stay in the catalog, and the academic head still sees a record of this action in their logs.
                                                Batches awaiting review or still in progress are kept.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleClearHistory} className="bg-red-600 hover:bg-red-700">
                                                Clear History
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                            <BatchUploadList
                                batches={uploadHistory}
                                total={uploadHistoryTotal}
                                loading={uploadHistoryLoading}
                                isAcademicHead={false}
                                page={batchPage}
                                onPageChange={setBatchPage}
                                onSubmitBatch={submitBatch}
                                onApproveBatch={async () => ({ error: 'Not available' })}
                                onRejectBatch={async () => ({ error: 'Not available' })}
                                onSendBackBatch={async () => ({ error: 'Not available' })}
                                onDeleteBatch={deleteBatch}
                                onRequestDeletion={requestDeletion}
                                onRefresh={() => fetchUploadHistory({ page: batchPage })}
                            />
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
