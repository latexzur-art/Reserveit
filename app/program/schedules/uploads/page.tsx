'use client'

/**
 * Schedule Uploads Page — Program Head
 * Upload class schedules for the department; submits to academic head review queue.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { FileDropZone } from '@/components/schedule/FileDropZone'
import { BatchMetadataForm } from '@/components/schedule/BatchMetadataForm'
import { ManualEntryDialog } from '@/components/schedule/ManualEntryDialog'
import { BulkManualEntryTable } from '@/components/schedule/BulkManualEntryTable'
import { ConnectedTopBar } from '../../_components/ConnectedTopBar'
import {
    Upload,
    FileSpreadsheet,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Filter,
    Search,
    ChevronRight,
    RefreshCw,
    Plus,
    Send,
    Loader2,
    Download,
    Trash2,
    ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SkeletonList } from "@/components/ui/SkeletonList";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: 'Draft', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: FileSpreadsheet },
    parsing: { label: 'Parsing', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Clock },
    parsed: { label: 'Parsed', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20', icon: CheckCircle2 },
    pending_submission: { label: 'Ready to Submit', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Send },
    submitted: { label: 'Pending Review', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Clock },
    revision_requested: { label: 'Returned', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: AlertTriangle },
    approved: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
    partially_approved: { label: 'Partial', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: AlertTriangle },
    rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
    validation_failed: { label: 'Failed', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
}

const CANCELLABLE_STATUSES = ['draft', 'parsing', 'parsed', 'pending_submission', 'validation_failed', 'failed']

export default function ProgramHeadScheduleUploadsPage() {
    const router = useRouter()
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [search, setSearch] = useState('')
    const [showUploadForm, setShowUploadForm] = useState(false)
    const [showManualEntry, setShowManualEntry] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [cancelling, setCancelling] = useState<string | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [metadata, setMetadata] = useState({
        academic_term_id: '',
        department_id: '',
        effective_start: '',
        effective_end: '',
    })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [manualEntries, setManualEntries] = useState<any[]>([])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('reserveit_program_manual_entries')
            if (saved) {
                try { setManualEntries(JSON.parse(saved)) } catch (e) {}
            }
        }
    }, [])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('reserveit_program_manual_entries', JSON.stringify(manualEntries))
        }
    }, [manualEntries])
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [blockingUploadId, setBlockingUploadId] = useState<string | null>(null)
    const [entryMode, setEntryMode] = useState<'file' | 'bulk'>('file')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [uploads, setUploads] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

    const fetchUploads = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (statusFilter) params.set('status', statusFilter)
            const res = await fetch(`/api/schedules/uploads?${params}`)
            const data = await res.json()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            setUploads((data.uploads ?? []) as any[])
        } catch {
            setUploads([])
        }
        setLoading(false)
    }, [statusFilter])

    useEffect(() => { fetchUploads() }, [fetchUploads])

    const refetch = fetchUploads

    const filtered = useMemo(() => {
        if (!search) return uploads
        const q = search.toLowerCase()
        return uploads.filter(u =>
            u.source_file_name?.toLowerCase().includes(q) ||
            u.departments?.name?.toLowerCase().includes(q) ||
            u.users?.full_name?.toLowerCase().includes(q)
        )
    }, [uploads, search])

    const handleFileUpload = useCallback(async () => {
        if (!selectedFile || !metadata.academic_term_id) return
        setUploading(true)
        setUploadError(null)
        setBlockingUploadId(null)

        try {
            const form = new FormData()
            form.append('file', selectedFile)
            form.append('academic_term_id', metadata.academic_term_id)
            if (metadata.department_id) form.append('department_id', metadata.department_id)
            if (metadata.effective_start) form.append('effective_start', metadata.effective_start)
            if (metadata.effective_end) form.append('effective_end', metadata.effective_end)

            const res = await fetch('/api/schedules/uploads/parse', { method: 'POST', body: form })
            const data = await res.json()

            if (!res.ok) {
                if (res.status === 409 && data.blocking_upload_id) setBlockingUploadId(data.blocking_upload_id)
                throw new Error(data.error || 'Upload failed')
            }

            await refetch()
            setShowUploadForm(false)
            setSelectedFile(null)
            setMetadata({ academic_term_id: '', department_id: '', effective_start: '', effective_end: '' })

            router.push(`/program/schedules/review/${data.upload_id}`)
        } catch (err: unknown) {
            setUploadError(err instanceof Error ? err.message : String(err))
        }
        setUploading(false)
    }, [selectedFile, metadata, refetch, router])

    const handleManualUpload = useCallback(async () => {
        if (manualEntries.length === 0 || !metadata.academic_term_id) return
        setUploading(true)
        setUploadError(null)
        setBlockingUploadId(null)

        try {
            const res = await fetch('/api/schedules/uploads/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    academic_term_id: metadata.academic_term_id,
                    department_id: metadata.department_id || undefined,
                    entries: manualEntries,
                }),
            })
            const data = await res.json()

            if (!res.ok) {
                if (res.status === 409 && data.blocking_upload_id) setBlockingUploadId(data.blocking_upload_id)
                throw new Error(data.error || 'Upload failed')
            }

            await refetch()
            setShowUploadForm(false)
            setManualEntries([])
            localStorage.removeItem('reserveit_program_manual_entries')
            router.push(`/program/schedules/review/${data.upload_id}`)
        } catch (err: unknown) {
            setUploadError(err instanceof Error ? err.message : String(err))
        }
        setUploading(false)
    }, [manualEntries, metadata, refetch, router])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAddManualEntry = (entry: any) => {
        setManualEntries(prev => [...prev, entry])
    }

    const handleCancel = useCallback(async () => {
        if (!deleteTarget) return
        setCancelling(deleteTarget)
        setDeleteTarget(null)
        try {
            const res = await fetch(`/api/schedules/uploads/${deleteTarget}`, { method: 'DELETE' })
            if (!res.ok) {
                const data = await res.json()
                toast.error(data.error || 'Failed to delete upload.')
            } else {
                await refetch()
            }
        } catch {
            toast.error('Failed to delete upload.')
        }
        setCancelling(null)
    }, [deleteTarget, refetch])

    const downloadTemplate = useCallback(async () => {
        const { createBrandedWorkbook, downloadWorkbook } = await import('@/lib/excel-branding')

        const workbook = createBrandedWorkbook({
            title: 'Official STI Schedule Upload Template',
            subtitle: 'Fill in your department schedules below. Required: COURSE (Section), DAY, START, END, ROOM, COURSE CODE, COURSE TITLE, INSTRUCTORS.',
            sheetName: 'BSCS',
            columns: [
                { header: 'COURSE', key: 'course', width: 15 },
                { header: 'DAY', key: 'day', width: 12 },
                { header: 'START', key: 'start', width: 12 },
                { header: 'END', key: 'end', width: 12 },
                { header: 'ROOM', key: 'room', width: 12 },
                { header: 'MERGE', key: 'merge', width: 15 },
                { header: 'COURSE CODE', key: 'course_code', width: 15 },
                { header: 'COURSE TITLE', key: 'course_title', width: 35 },
                { header: 'UNITS', key: 'units', width: 10 },
                { header: 'INSTRUCTORS', key: 'instructors', width: 25 },
                { header: 'CLASS NO.', key: 'class_no', width: 15 },
                { header: 'CODE', key: 'code', width: 12 },
                { header: 'SECTION CODE', key: 'section_code', width: 15 },
            ],
            rows: []
        })

        const worksheet = workbook.getWorksheet('BSCS')!

        // Sample row 1
        worksheet.addRow({
            course: 'BSCS 4/1-1',
            day: 'F',
            start: '12:00 PM',
            end: '1:00 PM',
            room: '201',
            merge: '',
            course_code: 'STIC1007',
            course_title: 'Euthenics 2',
            units: 1,
            instructors: 'Gonzales',
            class_no: '14840',
            code: '',
            section_code: '',
        })

        // Sample row 2 (Composite day MTH)
        worksheet.addRow({
            course: 'BSCS 4/1-1',
            day: 'MTH',
            start: '3:00 PM',
            end: '4:00 PM',
            room: 'MPH2',
            merge: '',
            course_code: 'INTE1005',
            course_title: 'Network Technology 1 (Lec)',
            units: 2,
            instructors: 'De Torres',
            class_no: '14735',
            code: '',
            section_code: '',
        })

        // Sample row 3 (Primary day slot)
        worksheet.addRow({
            course: 'BSCS 4/1-1',
            day: 'TF',
            start: '1:00 PM',
            end: '3:00 PM',
            room: '213',
            merge: '',
            course_code: 'BUSS1013',
            course_title: 'Technopreneurship',
            units: 3,
            instructors: 'Baylen',
            class_no: '18119',
            code: '',
            section_code: '',
        })

        // Sample row 4 (Continuation slot — blank course headers allowed!)
        worksheet.addRow({
            course: '',
            day: 'T',
            start: '10:00 AM',
            end: '11:30 AM',
            room: '',
            merge: '',
            course_code: '',
            course_title: '',
            units: '',
            instructors: '',
            class_no: '',
            code: '',
            section_code: '',
        })

        await downloadWorkbook(workbook, 'STI_Schedule_Template.xlsx')
    }, [])

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <ConnectedTopBar title="Schedule Uploads" />
            <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">SCHEDULE <span className="text-accent-brand">UPLOADS</span></h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Upload your department's class schedules for academic head review.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={refetch}
                            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setShowUploadForm(!showUploadForm)}
                            className="flex items-center gap-2 px-4 py-2 bg-sti-blue hover:bg-sti-blue/90 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Upload className="h-4 w-4" />
                            New Upload
                        </button>
                    </div>
                </div>

                {/* Upload Form (collapsible) */}
                {showUploadForm && (
                    <div className="border rounded-xl p-6 space-y-5 bg-muted/30">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <Upload className="h-4 w-4 text-sti-blue" />
                            Upload Schedule
                        </h2>

                        <BatchMetadataForm value={{ ...metadata, notes: '' }} onChange={(meta) => setMetadata({ academic_term_id: meta.academic_term_id, department_id: meta.department_id, effective_start: meta.effective_start, effective_end: meta.effective_end })} />

                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-xs text-muted-foreground">Select input method</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        <Tabs value={entryMode} onValueChange={(v) => setEntryMode(v as 'file' | 'bulk')} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 h-10 p-1 bg-muted/50 rounded-lg">
                                <TabsTrigger value="file" className="rounded-md text-xs font-medium transition-all data-[state=active]:bg-sti-blue data-[state=active]:text-white data-[state=active]:shadow-sm">File Upload</TabsTrigger>
                                <TabsTrigger value="bulk" className="rounded-md text-xs font-medium transition-all data-[state=active]:bg-sti-blue data-[state=active]:text-white data-[state=active]:shadow-sm">Manual Entry (Table)</TabsTrigger>
                            </TabsList>

                            <TabsContent value="file" className="mt-0">
                                <div className="flex items-center justify-between bg-muted/50 border rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <FileSpreadsheet className="h-4 w-4 text-sti-blue" />
                                        <div>
                                            <p className="text-xs font-medium">Need help formatting?</p>
                                            <p className="text-[10px] text-muted-foreground">Download our professional Excel template with sample data</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={downloadTemplate}
                                        className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-accent transition-colors"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Download Template
                                    </button>
                                </div>

                                <FileDropZone onFileSelected={setSelectedFile} />
                            </TabsContent>

                            <TabsContent value="bulk" className="mt-0">
                                <div className="rounded-[2rem] border border-slate-100 dark:border-white/5 overflow-hidden p-6 w-full max-w-full">
                                    <BulkManualEntryTable rows={manualEntries} onChange={setManualEntries} />
                                </div>
                            </TabsContent>
                        </Tabs>

                        {uploadError && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive space-y-1">
                                <div className="flex items-center gap-2">
                                    <XCircle className="h-4 w-4 flex-shrink-0" /> {uploadError}
                                </div>
                                {blockingUploadId && (
                                    <Link
                                        href={`/program/schedules/review/${blockingUploadId}`}
                                        className="flex items-center gap-1 text-sti-blue hover:underline font-medium"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        View blocking upload
                                    </Link>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => { setShowUploadForm(false); setSelectedFile(null); setManualEntries([]); setUploadError(null) }}
                                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={manualEntries.length > 0 ? handleManualUpload : handleFileUpload}
                                disabled={uploading || (!selectedFile && manualEntries.length === 0) || !metadata.academic_term_id}
                                className="flex items-center gap-2 px-5 py-2 bg-sti-blue hover:bg-sti-blue/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {uploading ? 'Uploading...' : 'Parse & Stage'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by file or department..."
                            aria-label="Search uploads by file or department"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm bg-background placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-sti-blue/50"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        {[
                            { label: 'All', value: '' },
                            { label: 'Ready to Submit', value: 'pending_submission' },
                            { label: 'Pending Review', value: 'submitted' },
                            { label: 'Returned', value: 'revision_requested' },
                            { label: 'Approved', value: 'approved' },
                            { label: 'Rejected', value: 'rejected' },
                        ].map(f => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors border',
                                    statusFilter === f.value
                                        ? 'bg-sti-blue/10 text-sti-blue border-sti-blue/30'
                                        : 'hover:bg-accent text-muted-foreground',
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Total', value: uploads.length, color: 'text-foreground' },
                        { label: 'Pending Review', value: uploads.filter(u => ['submitted', 'pending_submission'].includes(u.upload_status)).length, color: 'text-amber-600' },
                        { label: 'Approved', value: uploads.filter(u => u.upload_status === 'approved').length, color: 'text-emerald-600' },
                        { label: 'Needs Attention', value: uploads.filter(u => ['revision_requested', 'rejected'].includes(u.upload_status)).length, color: 'text-orange-600' },
                    ].map(stat => (
                        <div key={stat.label} className="border rounded-xl p-4">
                            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Upload List */}
                {loading ? (
                    <SkeletonList />
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <Upload className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground text-sm">No uploads found</p>
                        <button
                            onClick={() => setShowUploadForm(true)}
                            className="mt-3 text-sti-blue text-sm hover:underline"
                        >
                            Create your first upload
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((upload) => {
                            const statusInfo = STATUS_CONFIG[upload.upload_status] ?? STATUS_CONFIG.draft
                            const StatusIcon = statusInfo.icon
                            const canCancel = CANCELLABLE_STATUSES.includes(upload.upload_status)

                            return (
                                <div key={upload.id} className="group border hover:border-sti-blue/30 rounded-xl p-5 transition-all hover:bg-sti-blue/5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-sti-blue/10 flex items-center justify-center flex-shrink-0">
                                            <FileSpreadsheet className="h-5 w-5 text-sti-blue" />
                                        </div>

                                        <Link
                                            href={`/program/schedules/review/${upload.id}`}
                                            className="flex-1 min-w-0"
                                        >
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="text-sm font-medium truncate">
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
                                                <p className="font-semibold">{upload.total_entries}</p>
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
                                            <button
                                                onClick={(e) => { e.preventDefault(); setDeleteTarget(upload.id) }}
                                                disabled={cancelling === upload.id}
                                                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                                title="Delete upload"
                                            >
                                                {cancelling === upload.id
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <Trash2 className="h-4 w-4" />
                                                }
                                            </button>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-sti-blue transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                <ManualEntryDialog
                    open={showManualEntry}
                    onClose={() => setShowManualEntry(false)}
                    onSubmit={handleAddManualEntry}
                    existingEntries={manualEntries}
                />

                <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                                Delete Upload
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                            This will permanently delete the upload and all its entries. This action cannot be undone.
                        </p>
                        <DialogFooter className="gap-2 sm:gap-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 px-4 py-2 text-sm border rounded-lg hover:bg-accent transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCancel}
                                className="flex-1 px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors font-medium"
                            >
                                Delete
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    )
}
