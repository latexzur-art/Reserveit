/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  X, Upload, Download, FileText, AlertCircle, CheckCircle, AlertTriangle, Loader2,
  Pencil, Trash2, Rocket, RefreshCw, ShieldAlert, Filter,
} from 'lucide-react'
import { CourseFormModal } from '@/components/curriculum/CourseFormModal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BulkManualCourseTable, type CourseManualEntry } from './BulkManualCourseTable'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Course, CourseCreateInput } from '@/types/course.types'

const YEAR_LEVEL_LABEL_MAP: Record<string, number | null> = {
  '1st Year': 1, '2nd Year': 2, '3rd Year': 3, '4th Year': 4, 'Mixed / All Years': null,
}
const SEMESTER_LABEL_MAP: Record<string, number | null> = {
  '1st Semester': 1, '2nd Semester': 2, 'Summer': 3, 'Mixed / All Semesters': null,
}

interface CourseUploadModalProps {
  open: boolean
  onClose: () => void
  onUpload: (file: File, deptId: string, termId?: string, uploaderNotes?: string, labelYearLevel?: number | null, labelTerm?: number | null) => Promise<any>
  onSubmitBatch: (batchId: string) => Promise<{ error?: string }>
  onDownloadTemplate: (opts?: { code: string; name: string } | { mixed: true; allCodes: string[] }) => Promise<void>
  /** Optional — when provided, an Academic Head can publish the freshly parsed batch directly. */
  onPublishBatch?: (batchId: string) => Promise<{ error?: string; message?: string }>
  isAcademicHead?: boolean
  departmentId?: string
  termId?: string
}

type RowFilter = 'all' | 'error' | 'warning' | 'valid'

export function CourseUploadModal({
  open, onClose, onUpload, onSubmitBatch, onDownloadTemplate, onPublishBatch, isAcademicHead, departmentId, termId,
}: CourseUploadModalProps) {
  const [stage, setStage] = useState<0 | 1 | 2>(0)
  const [departments, setDepartments] = useState<{ id: string; code: string; name: string }[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState(departmentId ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [selectedYearLevel, setSelectedYearLevel] = useState('Mixed / All Years')
  const [selectedSemester, setSelectedSemester] = useState('Mixed / All Semesters')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishConfirm, setPublishConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [batchCourses, setBatchCourses] = useState<Course[]>([])
  const [coursesLoading, setCoursesLoading] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [rowFilter, setRowFilter] = useState<RowFilter>('all')
  const fileRef = useRef<HTMLInputElement>(null)
  const [showExitPrompt, setShowExitPrompt] = useState(false)
  
  const [entryMode, setEntryMode] = useState<'file' | 'bulk'>('file')
  const [manualEntries, setManualEntries] = useState<CourseManualEntry[]>([])

  useEffect(() => {
    fetch('/api/departments')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.departments) setDepartments(data.departments) })
  }, [])

  // Non-academic-head uploaders (program heads) are locked to their own department,
  // which arrives asynchronously via the departmentId prop.
  useEffect(() => {
    if (!isAcademicHead && departmentId) setSelectedDeptId(departmentId)
  }, [isAcademicHead, departmentId])

  // Prevent accidental page refreshes or closing the tab during the review stage
  useEffect(() => {
    if (stage !== 2) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [stage])

  const handleClose = (options?: { keepDraft?: boolean; discardDraft?: boolean; skipPrompt?: boolean }) => {
    if (stage === 2 && !options?.keepDraft && !options?.discardDraft && !options?.skipPrompt) {
      setShowExitPrompt(true)
      return
    }

    if (options?.discardDraft && result?.batch_id) {
      fetch(`/api/courses/batch/${result.batch_id}`, { method: 'DELETE' })
    }

    setStage(0)
    setSelectedDeptId(departmentId ?? '')
    setFile(null)
    setSelectedYearLevel('Mixed / All Years')
    setSelectedSemester('Mixed / All Semesters')
    setAdditionalNotes('')
    setResult(null)
    setError('')
    setBatchCourses([])
    setRowFilter('all')
    setPublishConfirm(false)
    setShowExitPrompt(false)
    setEntryMode('file')
    setManualEntries([])
    onClose()
  }

  const triggerClose = () => {
    handleClose()
  }

  // Pull the just-committed courses from the new batch so the uploader can edit them inline.
  const loadBatchCourses = async (batchId: string) => {
    setCoursesLoading(true)
    try {
      const res = await fetch(`/api/courses?batch_upload_id=${batchId}&limit=500`)
      const data = await res.json()
      if (res.ok) setBatchCourses(data.courses ?? [])
    } finally {
      setCoursesLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    setResult(null)
    setBatchCourses([])

    const generatedNotes = [selectedYearLevel, selectedSemester, additionalNotes.trim()].filter(Boolean).join(' - ')

    const res = await onUpload(file, selectedDeptId, termId, generatedNotes, YEAR_LEVEL_LABEL_MAP[selectedYearLevel], SEMESTER_LABEL_MAP[selectedSemester])
    if (res.error && !res.batch_id) {
      setError(res.error)
    } else {
      setResult(res)
      setStage(2)
      if (res.batch_id) await loadBatchCourses(res.batch_id)
    }
    setUploading(false)
  }

  const handleSubmit = async () => {
    if (!result?.batch_id) return
    if (blockingElectives.length > 0) {
      setError(
        `${blockingElectives.length} course${blockingElectives.length > 1 ? 's are' : ' is'} marked Elective but ${blockingElectives.length > 1 ? 'need' : 'needs'} a name before you can submit — click Edit on each highlighted row to add one.`
      )
      return
    }
    if (duplicateConflicts.length > 0) {
      setError(`${duplicateConflicts.length} course(s) conflict with the existing catalog — fix your file and re-upload before submitting.`)
      return
    }
    setSubmitting(true)
    const res = await onSubmitBatch(result.batch_id)
    if (res.error) {
      setError(res.error)
    } else {
      handleClose({ skipPrompt: true })
    }
    setSubmitting(false)
  }

  const handlePublish = async () => {
    if (!result?.batch_id || !onPublishBatch) return
    if (blockingElectives.length > 0) {
      setError(
        `${blockingElectives.length} course${blockingElectives.length > 1 ? 's are' : ' is'} marked Elective but ${blockingElectives.length > 1 ? 'need' : 'needs'} a name before you can publish — click Edit on each highlighted row to add one.`
      )
      return
    }
    if (duplicateConflicts.length > 0) {
      setError(`${duplicateConflicts.length} course(s) conflict with the existing catalog — fix your file and re-upload before publishing.`)
      return
    }
    setPublishing(true)
    setError('')
    const res = await onPublishBatch(result.batch_id)
    if (res.error) {
      setError(res.error)
      setPublishing(false)
    } else {
      setPublishing(false)
      setPublishConfirm(false)
      handleClose({ skipPrompt: true })
    }
  }

  const handleCancelUpload = async () => {
    if (!result?.batch_id) {
      setStage(1)
      setResult(null)
      setFile(null)
      setSelectedYearLevel('Mixed / All Years')
      setSelectedSemester('Mixed / All Semesters')
      setAdditionalNotes('')
      setError('')
      return
    }
    setCancelling(true)
    await fetch(`/api/courses/batch/${result.batch_id}`, { method: 'DELETE' })
    setCancelling(false)
    setStage(1)
    setResult(null)
    setBatchCourses([])
    setFile(null)
    setManualEntries([])
    setSelectedYearLevel('Mixed / All Years')
    setSelectedSemester('Mixed / All Semesters')
    setAdditionalNotes('')
    setError('')
  }

  const handleManualUpload = async () => {
    if (manualEntries.length === 0) return
    
    // Convert to CSV
    const isMixed = selectedDeptId === MIXED
    const headers = []
    if (isMixed) headers.push('Department Code')
    headers.push('Course Code', 'Course Name', 'Units', 'Year Level', 'Term', 'Delivery Mode', 'Lecture Hours', 'Lab Hours', 'Is Elective', 'Elective Name')
    
    const csvRows = manualEntries.map(r => {
        const cols = []
        if (isMixed) cols.push(`"${r.department_code || ''}"`)
        cols.push(
            `"${r.course_code}"`, `"${r.course_name}"`, `"${r.units}"`, `"${r.year_level}"`, `"${r.term}"`,
            `"${r.delivery_mode}"`, `"${r.lecture_hours}"`, `"${r.lab_hours}"`,
            `"${r.is_elective ? 'Yes' : 'No'}"`, `"${r.elective_type}"`
        )
        return cols.join(',')
    })

    const csvContent = [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const manualFile = new File([blob], 'manual_entry.csv', { type: 'text/csv' })

    setUploading(true)
    setError('')
    setResult(null)
    setBatchCourses([])

    const generatedNotes = [selectedYearLevel, selectedSemester, additionalNotes.trim(), '(Manual Grid Entry)'].filter(Boolean).join(' - ')

    const res = await onUpload(manualFile, selectedDeptId, termId, generatedNotes, YEAR_LEVEL_LABEL_MAP[selectedYearLevel], SEMESTER_LABEL_MAP[selectedSemester])
    if (res.error && !res.batch_id) {
      setError(res.error)
    } else {
      setResult(res)
      setStage(2)
      if (res.batch_id) await loadBatchCourses(res.batch_id)
    }
    setUploading(false)
  }

  // Lets the user click an earlier stepper step to go back. If a batch was already
  // committed (stage 2), it's discarded first — same as "Discard Upload" — so nothing
  // is left orphaned in 'pending_submission'/'validation_failed' limbo. File, year/term
  // labels, and notes are kept as-is so the user can tweak them instead of starting over.
  const goToStage = async (idx: 0 | 1) => {
    if (idx >= stage || cancelling) return
    if (result?.batch_id) {
      setCancelling(true)
      await fetch(`/api/courses/batch/${result.batch_id}`, { method: 'DELETE' })
      setCancelling(false)
    }
    setStage(idx)
    setResult(null)
    setBatchCourses([])
    setError('')
  }

  const handleCourseUpdate = async (input: CourseCreateInput) => {
    if (!editingCourse) return { error: 'No course selected' }
    const res = await fetch(`/api/courses/${editingCourse.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Update failed' }
    setBatchCourses(prev => prev.map(c => c.id === editingCourse.id ? { ...c, ...data.course } : c))
    setEditingCourse(null)
    return {}
  }

  const handleCourseDelete = async (courseId: string) => {
    const res = await fetch(`/api/courses/${courseId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Delete failed')
      return
    }
    setBatchCourses(prev => prev.filter(c => c.id !== courseId))
    setDeleteConfirmId(null)
  }

  const handleRefreshAfterEdits = async () => {
    if (!result?.batch_id) return
    await loadBatchCourses(result.batch_id)
  }

  const MIXED = '__mixed__'
  const isMixed = selectedDeptId === MIXED
  const selectedDept = isMixed ? null : departments.find(d => d.id === selectedDeptId)

  const templateOpts = isMixed
    ? { mixed: true as const, allCodes: departments.map(d => d.code) }
    : selectedDept ? { code: selectedDept.code, name: selectedDept.name } : undefined

  const statusOf = (c: Course): 'approved' | 'pending' | 'rejected' | 'sent_back' => c.approval_status as any

  const counts = useMemo(() => {
    const total = batchCourses.length
    const errors = batchCourses.filter(c => statusOf(c) === 'rejected').length
    const valid = batchCourses.filter(c => statusOf(c) !== 'rejected').length
    return { total, errors, valid }
  }, [batchCourses])

  const filteredCourses = useMemo(() => {
    if (rowFilter === 'error') return batchCourses.filter(c => statusOf(c) === 'rejected')
    if (rowFilter === 'valid') return batchCourses.filter(c => statusOf(c) !== 'rejected')
    if (rowFilter === 'warning') return batchCourses.filter(c => c.rejection_reason && statusOf(c) !== 'rejected')
    return batchCourses
  }, [batchCourses, rowFilter])

  // Mandatory confirmation gate: electives must have an explicit name before the batch can be submitted/published.
  const blockingElectives = useMemo(
    () => batchCourses.filter(c => c.is_elective && !c.elective_type?.trim()),
    [batchCourses]
  )

  // Rows the server flagged as conflicting with an existing, already-approved course with
  // different values. These never get written to `courses` and block submission until fixed.
  const duplicateConflicts = useMemo(
    () => (result?.validation_results ?? []).filter((r: any) => r.errors?.some((e: any) => e.field === 'duplicate_conflict')),
    [result]
  )

  // Rows identical to an existing course — a harmless no-op, skipped but never blocking.
  const identicalDuplicates = useMemo(
    () => (result?.validation_results ?? []).filter((r: any) => r.errors?.some((e: any) => e.field === 'duplicate_identical')),
    [result]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upload Course Catalog</h2>
            {/* Stepper */}
            <div className="hidden sm:flex items-center gap-2 ml-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {(['Department', 'Upload', 'Review & Edit'] as const).map((label, idx) => {
                const clickable = idx < stage && idx < 2 && !cancelling
                return (
                  <div
                    key={label}
                    role={clickable ? 'button' : undefined}
                    onClick={clickable ? () => goToStage(idx as 0 | 1) : undefined}
                    className={`flex items-center gap-1.5 ${clickable ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
                  >
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                      stage === idx ? 'bg-blue-600 text-white dark:bg-blue-500' : stage > idx ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className={stage === idx ? 'text-slate-900 dark:text-white font-bold' : ''}>{label}</span>
                    {idx < 2 && <span className="mx-1 text-slate-400 dark:text-slate-600">›</span>}
                  </div>
                )
              })}
            </div>
          </div>
          <button 
            onClick={triggerClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-4 py-3 rounded-xl flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}

          {/* Stage 0: Department selection */}
          {stage === 0 && (
            <>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {isAcademicHead
                  ? 'Select the department this upload is for before proceeding.'
                  : 'Confirm the department this upload is for before proceeding.'}
              </p>
              <div className="space-y-2">
                <label className="text-sm font-semibold block text-slate-900 dark:text-slate-100">Department</label>
                {isAcademicHead ? (
                  <select
                    value={selectedDeptId}
                    onChange={e => setSelectedDeptId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3.5 text-sm font-medium shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a department...</option>
                    <option value={MIXED}>Mixed Departments (select dept per course in file)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                ) : (
                  <div className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 px-3.5 text-sm flex items-center font-medium text-slate-700 dark:text-slate-300">
                    {selectedDept ? `${selectedDept.name} (${selectedDept.code})` : 'Loading your department…'}
                  </div>
                )}
                {isMixed && isAcademicHead && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Mixed mode: each row must include a <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">department_code</code> column. Use the mixed template below.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2.5 pt-3">
                <Button variant="outline" className="h-10 px-5 rounded-xl text-xs font-semibold" onClick={() => handleClose()}>Cancel</Button>
                <Button disabled={!selectedDeptId} className="h-10 px-6 rounded-xl text-xs font-semibold" onClick={() => setStage(1)}>Continue</Button>
              </div>
            </>
          )}

          {/* Stage 1: File upload */}
          {stage === 1 && (
            <>
              <div className="text-sm text-muted-foreground bg-muted/40 px-3 py-2 rounded flex items-center justify-between gap-2">
                <span>
                  Uploading for:{' '}
                  <span className="font-medium text-foreground">
                    {isMixed ? 'Mixed Departments' : `${selectedDept?.name} (${selectedDept?.code})`}
                  </span>
                </span>
                {isAcademicHead && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-600/40 bg-amber-50 dark:bg-amber-900/20 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    <ShieldAlert className="h-3 w-3" /> Privileged uploader
                  </span>
                )}
              </div>

              <Tabs value={entryMode} onValueChange={(v) => setEntryMode(v as 'file' | 'bulk')} className="w-full flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-2 h-10 p-1 bg-muted/50 rounded-lg shrink-0">
                  <TabsTrigger value="file" className="rounded-md text-xs font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">File Upload</TabsTrigger>
                  <TabsTrigger value="bulk" className="rounded-md text-xs font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Manual Entry (Table)</TabsTrigger>
                </TabsList>

                <TabsContent value="file" className="mt-4 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => onDownloadTemplate(templateOpts)}>
                      <Download className="h-4 w-4 mr-1" /> Download Template
                    </Button>
                    <span className="text-xs text-muted-foreground">Fill in the template (CSV or Excel), then upload it below.</span>
                  </div>

                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault() }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const dropped = e.dataTransfer?.files?.[0]
                      if (dropped) setFile(dropped)
                    }}
                  >
                    <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                    {file ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-medium">{file.name}</span>
                        <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    ) : (
                      <div>
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to select, or drag &amp; drop a CSV / Excel file here</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="bulk" className="mt-4 flex-1 min-h-0 flex flex-col">
                  <BulkManualCourseTable rows={manualEntries} onChange={setManualEntries} isMixedMode={isMixed} />
                </TabsContent>
              </Tabs>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {/* Year Level */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider block">
                    Year Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedYearLevel}
                    onChange={e => setSelectedYearLevel(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 dark:border-white/[0.08] bg-background px-3 text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                    <option value="Mixed / All Years">Mixed / All Years</option>
                  </select>
                </div>

                {/* Semester/Term */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider block">
                    Semester/Term <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedSemester}
                    onChange={e => setSelectedSemester(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 dark:border-white/[0.08] bg-background px-3 text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                    <option value="Summer">Summer</option>
                    <option value="Mixed / All Semesters">Mixed / All Semesters</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider block">
                  Additional Details <span className="text-slate-400 dark:text-slate-500">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={additionalNotes}
                  onChange={e => setAdditionalNotes(e.target.value)}
                  placeholder="Describe what is in this upload (e.g. Added electives, Revised BSCS curriculum)..."
                  className="w-full text-xs rounded-lg border border-slate-200 dark:border-white/[0.08] bg-background p-2.5 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 placeholder-slate-400 dark:placeholder-slate-600 resize-none"
                />
                <p className="text-[10px] text-muted-foreground">These details will be shown in history and audit logs to help differentiate this batch.</p>
              </div>
 
              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <Button variant="outline" onClick={() => {
                  setStage(0)
                  setFile(null)
                  setManualEntries([])
                  setSelectedYearLevel('Mixed / All Years')
                  setSelectedSemester('Mixed / All Semesters')
                  setAdditionalNotes('')
                  setError('')
                }}>Back</Button>
                <Button 
                  onClick={entryMode === 'bulk' ? handleManualUpload : handleUpload} 
                  disabled={uploading || (entryMode === 'file' && !file) || (entryMode === 'bulk' && manualEntries.length === 0)}
                >
                  {uploading ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Parsing &amp; validating...</> : 'Upload & Validate'}
                </Button>
              </div>
            </>
          )}

          {/* Stage 2: Review & edit parsed rows */}
          {stage === 2 && result && (
            <>
              {/* Summary banner */}
              <div className={`rounded-lg p-4 ${result.has_errors ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  {result.has_errors
                    ? <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                    : <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
                  <span className="font-medium">
                    {result.has_errors ? 'Some rows need attention' : 'All rows parsed cleanly'}
                  </span>
                  {isAcademicHead && (
                    <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-600/40 bg-amber-50 dark:bg-amber-900/30 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      <ShieldAlert className="h-3 w-3" /> Privileged Upload
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>Total: <strong>{result.total_rows}</strong> rows</span>
                  {(result.new_rows ?? 0) > 0 && (
                    <span className="text-green-700 dark:text-green-400">New: <strong>{result.new_rows}</strong></span>
                  )}
                  {(result.updated_rows ?? 0) > 0 && (
                    <span className="text-blue-700 dark:text-blue-400">Updates: <strong>{result.updated_rows}</strong></span>
                  )}
                  {(result.rejected_rows ?? 0) > 0 && (
                    <span className="text-red-700 dark:text-red-400">Errors: <strong>{result.rejected_rows}</strong></span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {isAcademicHead
                    ? 'You can edit any row below before publishing. Rejected rows can be fixed and they’ll be re-validated on save.'
                    : 'Fix any rejected rows before submitting for review — rejected rows will not enter the approval queue.'}
                </p>
              </div>

              {/* Duplicate-conflict banner — these rows were never written to the catalog */}
              {duplicateConflicts.length > 0 && (
                <div className="rounded-lg p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40">
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                    <span className="font-medium text-red-700 dark:text-red-300">
                      {duplicateConflicts.length} course(s) conflict with the existing catalog
                    </span>
                  </div>
                  <ul className="text-xs text-red-700 dark:text-red-300/90 space-y-0.5 mb-2">
                    {duplicateConflicts.map((r: any) => (
                      <li key={r.row}>
                        Row {r.row}{r.course_code ? ` (${r.course_code})` : ''}: {r.errors.find((e: any) => e.field === 'duplicate_conflict')?.message}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-red-700 dark:text-red-300/90">
                    Fix your source file and re-upload — Submit/Publish are disabled until these are resolved.
                  </p>
                </div>
              )}

              {/* Identical-duplicate note — harmless no-ops, skipped but never blocking */}
              {identicalDuplicates.length > 0 && (
                <div className="rounded-lg p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-xs text-muted-foreground">
                  {identicalDuplicates.length} course{identicalDuplicates.length > 1 ? 's' : ''} already exist{identicalDuplicates.length > 1 ? '' : 's'} unchanged in the catalog — skipped, no action needed
                  {' '}({identicalDuplicates.map((r: any) => r.course_code).filter(Boolean).join(', ')}).
                </div>
              )}

              {/* Filter tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                {(['all', 'error', 'valid'] as const).map(k => (
                  <button
                    key={k}
                    onClick={() => setRowFilter(k)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      rowFilter === k
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {k === 'all' && `All (${counts.total})`}
                    {k === 'error' && `Errors (${counts.errors})`}
                    {k === 'valid' && `Valid (${counts.valid})`}
                  </button>
                ))}
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={handleRefreshAfterEdits} disabled={coursesLoading}>
                  {coursesLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Refresh
                </Button>
              </div>

              {/* Editable rows table */}
              <div className="border rounded overflow-hidden">
                {coursesLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading parsed rows…
                  </div>
                ) : filteredCourses.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    {batchCourses.length === 0
                      ? 'No rows committed — check the parse errors in the summary above.'
                      : 'No rows match this filter.'}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2">Code</th>
                        <th className="text-left px-3 py-2">Name</th>
                        <th className="text-left px-3 py-2 hidden md:table-cell">Dept</th>
                        <th className="text-center px-3 py-2 hidden md:table-cell">Y / T</th>
                        <th className="text-center px-3 py-2">Units</th>
                        <th className="text-center px-3 py-2 hidden md:table-cell">Mode</th>
                        <th className="text-center px-3 py-2 hidden md:table-cell">Elective</th>
                        <th className="text-center px-3 py-2">Status</th>
                        <th className="text-center px-3 py-2 w-24">Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredCourses.map(c => {
                        const status = statusOf(c)
                        const needsElectiveName = !!c.is_elective && !c.elective_type?.trim()
                        const isError = status === 'rejected' || needsElectiveName
                        return (
                          <tr key={c.id} className={isError ? 'bg-red-50/40 dark:bg-red-900/10' : ''}>
                            <td className="px-3 py-1.5 font-mono">{c.course_code}</td>
                            <td className="px-3 py-1.5">{c.course_name}</td>
                            <td className="px-3 py-1.5 text-muted-foreground hidden md:table-cell">{c.department_code}</td>
                            <td className="px-3 py-1.5 text-center hidden md:table-cell">Y{c.year_level} / T{c.term}</td>
                            <td className="px-3 py-1.5 text-center">{c.units}</td>
                            <td className="px-3 py-1.5 text-center capitalize hidden md:table-cell">{c.delivery_mode}</td>
                            <td className="px-3 py-1.5 text-center hidden md:table-cell">
                              {c.is_elective
                                ? (c.elective_type?.trim()
                                    ? <span className="text-foreground">{c.elective_type}</span>
                                    : <span className="text-red-600 dark:text-red-400 font-medium">Missing name</span>)
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                isError
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              }`}>
                                {isError ? 'Error' : 'Valid'}
                              </span>
                              {c.rejection_reason && (
                                <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 truncate max-w-[220px]" title={c.rejection_reason}>
                                  {c.rejection_reason}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingCourse(c)}
                                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                  title="Edit row"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(c.id)}
                                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600"
                                  title="Delete row"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Row-level delete confirmation */}
              {deleteConfirmId && (
                <div className="flex items-center gap-2 text-xs bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded border border-red-200 dark:border-red-900/40">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  <span className="flex-1 text-red-700 dark:text-red-300">Permanently delete this row from the batch?</span>
                  <Button size="sm" variant="outline" className="h-6 text-xs text-red-600 border-red-300" onClick={() => handleCourseDelete(deleteConfirmId)}>Delete</Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                </div>
              )}

              {/* Publish confirmation (Academic Head only) */}
              {publishConfirm && (
                <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-300 dark:border-amber-600/40 rounded p-3 flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-semibold">Publish {counts.valid} course(s) directly to the catalog?</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-1">
                      Skips the review queue. Approves all <strong>valid</strong> rows under your name immediately. {counts.errors > 0 && <>The {counts.errors} error row(s) are skipped — fix or delete them first if you want them included.</>}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 text-amber-700 dark:text-amber-300 border-amber-400 dark:border-amber-500/50"
                    disabled={publishing} onClick={handlePublish}
                  >
                    {publishing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Rocket className="h-3 w-3 mr-1" />}
                    Confirm Publish
                  </Button>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => setPublishConfirm(false)}>Cancel</Button>
                </div>
              )}

              {/* Bottom actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={handleCancelUpload}
                  disabled={cancelling || submitting || publishing}
                >
                  {cancelling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  {cancelling ? 'Cancelling…' : 'Discard Upload'}
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                  {blockingElectives.length > 0 && (
                    <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> {blockingElectives.length} elective{blockingElectives.length > 1 ? 's' : ''} need{blockingElectives.length > 1 ? '' : 's'} a name
                    </span>
                  )}
                  {duplicateConflicts.length > 0 && (
                    <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> {duplicateConflicts.length} course{duplicateConflicts.length > 1 ? 's' : ''} conflict{duplicateConflicts.length > 1 ? '' : 's'} with the catalog
                    </span>
                  )}
                  {result.batch_id && counts.valid > 0 && !isAcademicHead && (
                    <Button onClick={handleSubmit} disabled={submitting || cancelling || blockingElectives.length > 0 || duplicateConflicts.length > 0}>
                      {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      {submitting ? 'Submitting…' : `Submit for Approval${counts.errors > 0 ? ` (${counts.valid} valid)` : ''}`}
                    </Button>
                  )}
                  {result.batch_id && counts.valid > 0 && isAcademicHead && onPublishBatch && !publishConfirm && (
                    <Button
                      onClick={() => setPublishConfirm(true)}
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                      disabled={publishing || cancelling || submitting || blockingElectives.length > 0 || duplicateConflicts.length > 0}
                    >
                      <Rocket className="h-3.5 w-3.5 mr-1" />
                      Publish Now ({counts.valid})
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Exit Prompt Dialog */}
        <AlertDialog open={showExitPrompt} onOpenChange={setShowExitPrompt}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Save Upload as Draft?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs">
                You have parsed and validated courses in this batch. Would you like to save this upload as a draft to resume later, or discard it entirely?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
              <Button
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => handleClose({ discardDraft: true })}
              >
                Discard Upload
              </Button>
              <Button
                className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => handleClose({ keepDraft: true })}
              >
                Save as Draft
              </Button>
            </AlertDialogFooter>
            <div className="text-center mt-2">
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground font-medium underline"
                onClick={() => setShowExitPrompt(false)}
              >
                Go Back to Review
              </button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Per-row edit modal — re-validates on save (server-side) */}
      <CourseFormModal
        open={!!editingCourse}
        onClose={() => setEditingCourse(null)}
        onSubmit={handleCourseUpdate}
        editingCourse={editingCourse}
        isAcademicHead={!!isAcademicHead}
      />
    </div>
  )
}
