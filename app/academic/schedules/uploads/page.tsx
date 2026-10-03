'use client'

/**
 * SchedulesUploadPage — Main landing for schedule bulk uploads (Excel/Manual).
 * Full upload flow: file drop → metadata → parse → review entries.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useScheduleUploads } from '@/hooks/academic-head/useScheduleUploads'
import { FileDropZone } from '@/components/schedule/FileDropZone'
import { BatchMetadataForm } from '@/components/schedule/BatchMetadataForm'
import { ManualEntryDialog } from '@/components/schedule/ManualEntryDialog'
import { BulkManualEntryTable } from '@/components/schedule/BulkManualEntryTable'
import { ValidationStatusBar } from '@/components/schedule/ValidationStatusBar'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SkeletonList } from "@/components/ui/SkeletonList";


const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: 'Draft', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: FileSpreadsheet },
    parsing: { label: 'Parsing', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Clock },
    parsed: { label: 'Parsed', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20', icon: CheckCircle2 },
    submitted: { label: 'Pending Review', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', icon: Clock },
    revision_requested: { label: 'Returned', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', icon: AlertTriangle },
    approved: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
    partially_approved: { label: 'Partial', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: AlertTriangle },
    rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', icon: XCircle },
    pending_submission: { label: 'Draft', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: FileSpreadsheet },
    validation_failed: { label: 'Error', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', icon: AlertTriangle },
}

export default function ScheduleUploadsPage() {
    const router = useRouter()
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [search, setSearch] = useState('')
    const [showUploadForm, setShowUploadForm] = useState(false)
    const [showManualEntry, setShowManualEntry] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [metadata, setMetadata] = useState({
        academic_term_id: '',
        department_id: '',
        effective_start: '',
        effective_end: '',
        notes: '',
    })
    const [manualEntries, setManualEntries] = useState<any[]>([])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('reserveit_academic_manual_entries')
            if (saved) {
                try { setManualEntries(JSON.parse(saved)) } catch (e) {}
            }
        }
    }, [])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('reserveit_academic_manual_entries', JSON.stringify(manualEntries))
        }
    }, [manualEntries])
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [entryMode, setEntryMode] = useState<'single' | 'bulk'>('bulk')

    const { uploads, loading, refetch } = useScheduleUploads(
        statusFilter ? { status: statusFilter } : undefined,
    )

    const handleDeleteUpload = async (e: React.MouseEvent, id: string) => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm('Are you sure you want to delete this upload? All staged entries will be lost.')) return

        try {
            const res = await fetch(`/api/schedules/uploads/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to delete')
            await refetch()
        } catch (err: any) {
            alert('Failed to delete: ' + err.message)
        }
    }

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

        try {
            const form = new FormData()
            form.append('file', selectedFile)
            form.append('academic_term_id', metadata.academic_term_id)
            if (metadata.department_id) form.append('department_id', metadata.department_id)
            if (metadata.effective_start) form.append('effective_start', metadata.effective_start)
            if (metadata.effective_end) form.append('effective_end', metadata.effective_end)
            if (metadata.notes) form.append('notes', metadata.notes)

            const res = await fetch('/api/schedules/uploads/parse', { method: 'POST', body: form })
            const data = await res.json()

            if (!res.ok) throw new Error(data.error || 'Upload failed')

            await refetch()
            setShowUploadForm(false)
            setSelectedFile(null)
            setMetadata({ academic_term_id: '', department_id: '', effective_start: '', effective_end: '', notes: '' })

            router.push(`/academic/schedules/review/${data.upload_id}`)
        } catch (err: any) {
            setUploadError(err.message)
        }
        setUploading(false)
    }, [selectedFile, metadata, refetch, router])

    const handleManualUpload = useCallback(async () => {
        if (manualEntries.length === 0 || !metadata.academic_term_id) return
        setUploading(true)
        setUploadError(null)

        try {
            const res = await fetch('/api/schedules/uploads/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    academic_term_id: metadata.academic_term_id,
                    department_id: metadata.department_id || undefined,
                    notes: metadata.notes || undefined,
                    entries: manualEntries,
                }),
            })
            const data = await res.json()

            if (!res.ok) throw new Error(data.error || 'Upload failed')

            await refetch()
            setShowUploadForm(false)
            setManualEntries([])
            localStorage.removeItem('reserveit_academic_manual_entries')
            router.push(`/academic/schedules/review/${data.upload_id}`)
        } catch (err: any) {
            setUploadError(err.message)
        }
        setUploading(false)
    }, [manualEntries, metadata, refetch, router])

    const handleAddManualEntry = (entry: any) => {
        setManualEntries(prev => [...prev, entry])
    }

    const downloadTemplate = useCallback(async () => {
        const { createBrandedWorkbook, downloadWorkbook } = await import('@/lib/excel-branding')

        const workbook = createBrandedWorkbook({
            title: 'Official STI Schedule Upload Template',
            subtitle: 'Fill in the class schedules below. Required: COURSE (Section), DAY, START, END, ROOM, COURSE CODE, COURSE TITLE, INSTRUCTORS.',
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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">
                            SCHEDULE <span className="text-accent-brand">UPLOADS</span>
                        </h1>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
                            Upload and manage class schedule submissions
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={refetch}
                            aria-label="Refresh upload list"
                            className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl text-slate-500 dark:text-slate-400 transition-all border border-slate-200 dark:border-slate-800 shadow-sm"
                        >
                            <RefreshCw className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => setShowUploadForm(!showUploadForm)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 h-12 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider shadow-xl shadow-blue-500/10 transition-all active:scale-95"
                        >
                            <Upload className="h-4 w-4" />
                            New Upload
                        </button>
                    </div>
                </div>

                {/* Upload Form (Seamless Collapsible) */}
                {showUploadForm && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 sm:p-10 space-y-8 shadow-xl animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-2xl">
                                <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Upload Configuration</h2>
                        </div>

                        <BatchMetadataForm value={metadata} onChange={(meta) => setMetadata({ ...meta, notes: meta.notes || '' })} />

                        {/* Template Download Card */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6">
                            <div className="flex items-center gap-5 text-center sm:text-left">
                                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm shrink-0 border border-slate-100 dark:border-slate-800">
                                    <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Need help formatting?</p>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Download our professional Excel template</p>
                                </div>
                            </div>
                            <button
                                onClick={downloadTemplate}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold uppercase tracking-wider border border-emerald-500/20 transition-all"
                            >
                                <Download className="h-4 w-4" />
                                Download Template
                            </button>
                        </div>

                        <FileDropZone onFileSelected={setSelectedFile} />

                        <div className="flex items-center gap-4">
                            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Manual Entry</span>
                            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                        </div>

                        <div className="flex flex-col gap-6">
                            <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl w-fit">
                                <button
                                    onClick={() => setEntryMode('bulk')}
                                    className={cn(
                                        'px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
                                        entryMode === 'bulk' ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                                    )}
                                >
                                    Bulk Mode
                                </button>
                                <button
                                    onClick={() => setEntryMode('single')}
                                    className={cn(
                                        'px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
                                        entryMode === 'single' ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                                    )}
                                >
                                    Single Mode
                                </button>
                            </div>

                            {entryMode === 'single' ? (
                                <div className="space-y-4">
                                    <button
                                        onClick={() => setShowManualEntry(true)}
                                        className="w-full py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:border-blue-500/30 dark:hover:border-blue-500/20 transition-all group"
                                    >
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-3xl group-hover:scale-110 transition-transform">
                                            <Plus className="h-6 w-6 text-slate-400" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Add Manual Record ({manualEntries.length})</span>
                                    </button>
                                    {manualEntries.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {manualEntries.map((e, i) => (
                                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                                                    <div className="space-y-0.5">
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">{e.course_code}</p>
                                                        <p className="text-xs font-medium text-slate-500 uppercase">{e.section} — {e.room}</p>
                                                    </div>
                                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">{e.start_time}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden p-6 w-full max-w-full bg-slate-50/50 dark:bg-slate-950/40">
                                    <BulkManualEntryTable rows={manualEntries} onChange={setManualEntries} />
                                </div>
                            )}
                        </div>

                        {uploadError && (
                            <div className="flex items-center gap-4 p-5 bg-rose-500/5 border border-rose-500/20 rounded-2xl animate-in shake duration-500">
                                <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
                                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">{uploadError}</p>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => { setShowUploadForm(false); setSelectedFile(null); setManualEntries([]); setUploadError(null) }}
                                className="w-full sm:w-auto px-8 h-12 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={manualEntries.length > 0 ? handleManualUpload : handleFileUpload}
                                disabled={uploading || (!selectedFile && manualEntries.length === 0) || !metadata.academic_term_id}
                                className="w-full sm:w-auto px-10 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider shadow-xl shadow-blue-500/20 transition-all disabled:opacity-40 disabled:scale-100 active:scale-95"
                            >
                                {uploading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                {uploading ? 'Processing Data...' : 'Parse & Stage Submission'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Search & Filter Bar */}
                <div className="flex flex-col lg:flex-row gap-4 px-1">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by file, department, or uploader..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-6 h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:uppercase placeholder:tracking-wider focus:outline-none focus:border-blue-500/50 shadow-sm transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                        {['', 'submitted', 'pending_submission', 'approved', 'rejected', 'revision_requested'].map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={cn(
                                    'whitespace-nowrap px-5 h-14 rounded-2xl text-xs font-bold uppercase tracking-wider border transition-all shrink-0',
                                    statusFilter === status
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                                )}
                            >
                                {status ? STATUS_CONFIG[status]?.label ?? status : 'All Status'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Summary Statistics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-1">
                    {[
                        { label: 'Total Volume', value: uploads.length, icon: FileSpreadsheet, color: 'text-slate-900 dark:text-white' },
                        { label: 'Pending Review', value: uploads.filter(u => u.upload_status === 'submitted').length, icon: Clock, color: 'text-blue-500' },
                        { label: 'Live Schedules', value: uploads.filter(u => u.upload_status === 'approved').length, icon: CheckCircle2, color: 'text-emerald-500' },
                        { label: 'Needs Action', value: uploads.filter(u => ['revision_requested', 'rejected'].includes(u.upload_status)).length, icon: AlertTriangle, color: 'text-orange-500' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-4">
                                <stat.icon className={cn('h-4 w-4', stat.color)} />
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</span>
                            </div>
                            <p className={cn('text-3xl font-black tracking-tight', stat.color)}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Content Area */}
                {loading ? (
                    <SkeletonList />
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center px-8 bg-white/40 dark:bg-slate-900/30 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
                        <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center mb-8 shadow-sm border border-slate-200 dark:border-slate-800">
                            <Upload className="h-10 w-10 text-slate-400 dark:text-slate-600" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-widest text-slate-900 dark:text-white mb-2">Repository Empty</h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide max-w-[320px] leading-relaxed mb-10">
                            No upload records match your current filter. Start by creating a new submission.
                        </p>
                        <button
                            onClick={() => setShowUploadForm(true)}
                            className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline transition-all"
                        >
                            Create First Upload +
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filtered.map((upload) => {
                            const statusInfo = STATUS_CONFIG[upload.upload_status] ?? STATUS_CONFIG.draft
                            const StatusIcon = statusInfo.icon

                            return (
                                <Link
                                    key={upload.id}
                                    href={`/academic/schedules/review/${upload.id}`}
                                    className="group relative flex flex-col sm:flex-row sm:items-center gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-blue-500/30 transition-all duration-300"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                                        <FileSpreadsheet className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                                    </div>

                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-[15px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate leading-none">
                                                {upload.source_file_name ?? 'Manual Submission'}
                                            </span>
                                            <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider border', statusInfo.color)}>
                                                <StatusIcon className="h-3.5 w-3.5" />
                                                {statusInfo.label}
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                            <span className="text-slate-900 dark:text-slate-200 font-semibold">{upload.departments?.name ?? 'General'}</span>
                                            <span className="opacity-40">•</span>
                                            <span>BY {upload.users?.full_name}</span>
                                            <span className="opacity-40">•</span>
                                            <span>{new Date(upload.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8 justify-between sm:justify-end border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-4 sm:pt-0">
                                        <div className="flex gap-8 px-4">
                                            <div className="text-center">
                                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Entries</p>
                                                <p className="text-sm font-black text-slate-900 dark:text-white">{upload.total_entries}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-0.5">Valid</p>
                                                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{upload.valid_entries_count}</p>
                                            </div>
                                            {upload.error_entries_count > 0 && (
                                                <div className="text-center">
                                                    <p className="text-xs font-bold text-rose-500 uppercase mb-0.5">Errors</p>
                                                    <p className="text-sm font-black text-rose-600 dark:text-rose-400">{upload.error_entries_count}</p>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {['draft', 'parsing', 'validation_failed', 'pending_submission', 'revision_requested'].includes(upload.upload_status) && (
                                                <button
                                                    onClick={(e) => handleDeleteUpload(e, upload.id)}
                                                    aria-label="Delete draft schedule upload"
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-90"
                                                >
                                                    <XCircle className="h-5 w-5" />
                                                </button>
                                            )}
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                <ChevronRight className="h-5 w-5" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Dialog Component (Preserved) */}
            <ManualEntryDialog
                open={showManualEntry}
                onClose={() => setShowManualEntry(false)}
                onSubmit={handleAddManualEntry}
                existingEntries={manualEntries}
            />
        </div>
    )
}