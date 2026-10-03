/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useCallback, Fragment } from 'react'
import type { CourseUploadBatch, Course, UploadStatus, CourseCreateInput } from '@/types/course.types'
import { Button } from '@/components/ui/button'
import { CourseFormModal } from '@/components/curriculum/CourseFormModal'
import { ChevronDown, ChevronRight, CheckCircle, XCircle, RotateCcw, Send, Loader2, Pencil, Trash2, ShieldCheck, AlertTriangle, User, Rocket, ShieldAlert, X } from 'lucide-react'

import { STATUS_LABELS, STATUS_COLORS, COURSE_STATUS_COLORS, MODE_LABELS } from './batch-constants'
import { uploadStatusLabel } from '@/lib/enum-labels'

export interface BatchRowProps {
  batch: CourseUploadBatch & { department_name?: string; uploader_name?: string; review_notes?: string; uploader_notes?: string }
  isAcademicHead: boolean
  currentUserId?: string
  onSubmit: (batchId: string) => Promise<{ error?: string }>
  onApprove: (batchId: string) => Promise<{ error?: string }>
  onReject: (batchId: string, reason: string) => Promise<{ error?: string }>
  onSendBack: (batchId: string, notes: string) => Promise<{ error?: string }>
  onRollback?: (batchId: string) => Promise<{ error?: string }>
  onDelete: (batchId: string) => Promise<{ error?: string }>
  onPublish?: (batchId: string) => Promise<{ error?: string; message?: string }>
  onRequestDeletion?: (batchId: string, reason: string) => Promise<{ error?: string }>
  onRefresh: () => void
}

export function BatchRow({ batch, isAcademicHead, currentUserId, onSubmit, onApprove, onReject, onSendBack, onRollback, onDelete, onPublish, onRequestDeletion, onRefresh }: BatchRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  // Batch-level prompts
  const [rejectPrompt, setRejectPrompt] = useState(false)
  const [sendBackPrompt, setSendBackPrompt] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteRequestPrompt, setDeleteRequestPrompt] = useState(false)
  const [publishConfirm, setPublishConfirm] = useState(false)
  const [reasonText, setReasonText] = useState('')

  // Academic Head is publishing their OWN batch (privileged self-publish).
  // Visible only when: viewer is academic head, batch belongs to viewer, and batch is in a publishable status.
  const isOwnBatch = !!currentUserId && batch.uploaded_by === currentUserId
  const publishableStatuses: string[] = ['draft', 'pending_submission', 'validation_failed', 'submitted']
  const canSelfPublish =
    isAcademicHead && isOwnBatch && !!onPublish && publishableStatuses.includes(batch.upload_status)

  // Course-level CRUD
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [deleteConfirmCourseId, setDeleteConfirmCourseId] = useState<string | null>(null)
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null)
  const [overridingCourseId, setOverridingCourseId] = useState<string | null>(null)

  const canEditCourses = ['draft', 'pending_submission'].includes(batch.upload_status) || isAcademicHead

  const fetchCourses = useCallback(async () => {
    if (courses !== null) return
    setLoadingCourses(true)
    try {
      const res = await fetch(`/api/courses?batch_upload_id=${batch.id}&limit=100`)
      const data = await res.json()
      setCourses(data.courses ?? [])
    } finally {
      setLoadingCourses(false)
    }
  }, [batch.id, courses])

  const handleToggle = () => {
    const next = !expanded
    setExpanded(next)
    if (next) fetchCourses()
  }

  const runAction = async (key: string, fn: () => Promise<{ error?: string }>) => {
    setActionLoading(key)
    setActionError('')
    const res = await fn()
    setActionLoading(null)
    if (res.error) {
      setActionError(res.error)
    } else {
      onRefresh()
    }
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
    // Splice updated course into local state
    setCourses(prev => prev?.map(c => c.id === editingCourse.id ? { ...c, ...data.course } : c) ?? null)
    setEditingCourse(null)
    return {}
  }

  const handleCourseDelete = async (courseId: string) => {
    setDeletingCourseId(courseId)
    const res = await fetch(`/api/courses/${courseId}`, { method: 'DELETE' })
    const data = await res.json()
    setDeletingCourseId(null)
    if (!res.ok) {
      setActionError(data.error ?? 'Delete failed')
      return
    }
    setCourses(prev => prev?.filter(c => c.id !== courseId) ?? null)
    setDeleteConfirmCourseId(null)
  }

  const handleCourseOverride = async (courseId: string) => {
    setOverridingCourseId(courseId)
    setActionError('')
    const res = await fetch(`/api/courses/${courseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'override' }),
    })
    const data = await res.json()
    setOverridingCourseId(null)
    if (!res.ok) {
      setActionError(data.error ?? 'Override failed')
      return
    }
    setCourses(prev => prev?.map(c => c.id === courseId ? { ...c, approval_status: 'approved', rejection_reason: null } : c) ?? null)
  }

  const uploadedDate = new Date(batch.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const submittedDate = batch.submitted_at
    ? new Date(batch.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-background hover:bg-muted/20 cursor-pointer select-none"
        onClick={handleToggle}
      >
        <span className="text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>

        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4">
          {/* Dept + uploader */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm truncate">{batch.department_name ?? 'Mixed Departments'}</p>
              {batch.uploader_name && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                  <User className="h-3 w-3" />
                  {batch.uploader_name}
                </span>
              )}
              {canSelfPublish && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-600/40 bg-amber-50 dark:bg-amber-900/20 text-xs font-semibold text-amber-700 dark:text-amber-300 shrink-0"
                  title="Privileged upload — publishes directly without the review queue"
                >
                  <ShieldAlert className="h-3 w-3" />
                  Privileged
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {MODE_LABELS[batch.upload_mode] ?? batch.upload_mode}
              {' · '}{uploadedDate}
              {submittedDate && ` · submitted ${submittedDate}`}
            </p>
            {batch.uploader_notes && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic font-medium">
                Note: &quot;{batch.uploader_notes}&quot;
              </p>
            )}
          </div>

          {/* Entry counts */}
          <div className="text-xs text-center">
            <p className="font-medium">{batch.total_entries}</p>
            <p className="text-muted-foreground">courses</p>
          </div>

          {/* Stats */}
          <div className="text-xs space-y-0.5 text-right hidden sm:block">
            {batch.approved_count > 0 && <p className="text-green-600 font-medium">{batch.approved_count} approved</p>}
            {batch.rejected_count > 0 && <p className="text-red-600 font-medium">{batch.rejected_count} rejected</p>}
            {batch.pending_count > 0 && <p className="text-yellow-600 font-medium">{batch.pending_count} pending</p>}
          </div>

          {/* Status badge */}
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[batch.upload_status]}`}>
            {STATUS_LABELS[batch.upload_status] ?? uploadStatusLabel(batch.upload_status)}
          </span>

          {/* Actions — stop propagation so clicks don't toggle expand */}
          <div className="flex flex-wrap gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
            {(batch.upload_status === 'pending_submission' ||
              (batch.upload_status === 'draft' && !isAcademicHead)) && (
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs font-semibold"
                disabled={actionLoading === 'submit'}
                onClick={() => runAction('submit', () => onSubmit(batch.id))}
              >
                {actionLoading === 'submit' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                {batch.upload_status === 'draft' ? 'Resubmit' : 'Submit'}
              </Button>
            )}

            {/* Privileged self-publish — Academic Head publishing their own batch */}
            {canSelfPublish && !publishConfirm && !rejectPrompt && !sendBackPrompt && !deleteConfirm && (
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs font-semibold text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600/40 bg-amber-50/50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                disabled={!!actionLoading}
                onClick={() => setPublishConfirm(true)}
                title="Publish this batch directly to the catalog (privileged self-publish)"
              >
                <Rocket className="h-3 w-3 mr-1" /> Publish
              </Button>
            )}

            {batch.upload_status === 'submitted' && isAcademicHead && !rejectPrompt && !sendBackPrompt && (
              <>
                <Button size="sm" variant="outline" className="h-8 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  disabled={!!actionLoading}
                  onClick={() => runAction('approve', () => onApprove(batch.id))}
                >
                  {actionLoading === 'approve' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs font-semibold text-amber-700 dark:text-amber-400 border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  onClick={() => { setSendBackPrompt(true); setReasonText('') }}
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Send Back
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs font-semibold text-red-600 dark:text-red-400 border-slate-200 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => { setRejectPrompt(true); setReasonText('') }}
                >
                  <XCircle className="h-3 w-3 mr-1" /> Reject
                </Button>
              </>
            )}

            {batch.upload_status === 'validation_failed' && isAcademicHead && batch.pending_count > 0 && !rejectPrompt && !sendBackPrompt && (
              <Button size="sm" variant="outline" className="h-8 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                disabled={!!actionLoading}
                onClick={() => runAction('approve', () => onApprove(batch.id))}
                title={`Approve ${batch.pending_count} valid course(s), skip the ${batch.rejected_count} rejected`}
              >
                {actionLoading === 'approve' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                Approve Valid ({batch.pending_count})
              </Button>
            )}

            {/* Rollback — academic head only, approved or partially_rejected batches */}
            {isAcademicHead && onRollback &&
              ['approved', 'partially_rejected'].includes(batch.upload_status) &&
              !rejectPrompt && !sendBackPrompt && !deleteConfirm && (
              <Button size="sm" variant="outline" className="h-8 text-xs font-semibold text-amber-700 dark:text-amber-400 border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                disabled={!!actionLoading}
                onClick={() => runAction('rollback', () => onRollback(batch.id))}
                title="Roll back approval — returns batch to the review queue"
              >
                {actionLoading === 'rollback' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                Rollback
              </Button>
            )}

            {/* Delete batch */}
            {batch.upload_status !== 'deleted' && (isAcademicHead || ['draft', 'pending_submission', 'rejected', 'partially_rejected', 'validation_failed'].includes(batch.upload_status)) && !deleteConfirm && !rejectPrompt && !sendBackPrompt && (
              <Button size="sm" variant="outline" className="h-8 text-xs font-semibold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 border-slate-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30"
                disabled={!!actionLoading}
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            )}

            {/* Request Deletion — program heads only, for submitted+ batches */}
            {!isAcademicHead && onRequestDeletion &&
              !['draft', 'pending_submission', 'rejected', 'partially_rejected', 'validation_failed', 'deleted'].includes(batch.upload_status) &&
              !(batch as any).review_notes?.startsWith('[DELETE_REQUESTED]') &&
              !deleteRequestPrompt && (
              <Button size="sm" variant="outline" className="text-orange-600 border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                disabled={!!actionLoading}
                onClick={() => { setDeleteRequestPrompt(true); setReasonText('') }}
              >
                <AlertTriangle className="h-3 w-3 mr-1" /> Request Deletion
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Inline reason prompts (reject / send-back) */}
      {(rejectPrompt || sendBackPrompt || deleteRequestPrompt) && (
        <div className="px-4 py-3 border-t bg-muted/10 flex items-center gap-3" onClick={e => e.stopPropagation()}>
          <input
            autoFocus
            className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-sm"
            placeholder={
              rejectPrompt ? 'Rejection reason…'
                : deleteRequestPrompt ? 'Reason for deletion request…'
                : 'Notes for program head…'
            }
            value={reasonText}
            onChange={e => setReasonText(e.target.value)}
          />
          <Button size="sm"
            disabled={!reasonText.trim() || !!actionLoading}
            onClick={() => {
              if (rejectPrompt) {
                runAction('reject', () => onReject(batch.id, reasonText.trim()))
                setRejectPrompt(false)
              } else if (deleteRequestPrompt && onRequestDeletion) {
                runAction('request_delete', () => onRequestDeletion(batch.id, reasonText.trim()))
                setDeleteRequestPrompt(false)
              } else {
                runAction('sendback', () => onSendBack(batch.id, reasonText.trim()))
                setSendBackPrompt(false)
              }
            }}
          >
            {deleteRequestPrompt ? 'Send Request' : 'Confirm'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setRejectPrompt(false); setSendBackPrompt(false); setDeleteRequestPrompt(false) }}>
            Cancel
          </Button>
        </div>
      )}

      {/* Privileged self-publish confirmation panel */}
      {publishConfirm && (
        <div
          className="px-4 py-3 border-t bg-amber-50 dark:bg-amber-900/10 flex items-start gap-3"
          onClick={e => e.stopPropagation()}
        >
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-800 dark:text-amber-200 space-y-1">
            <p className="font-semibold">Publish {batch.total_entries} course(s) directly to the catalog?</p>
            <p className="text-xs text-amber-700 dark:text-amber-300/90">
              This is a <strong>privileged self-publish</strong>: the batch will skip the review queue and {batch.pending_count > 0 ? batch.pending_count : batch.total_entries} pending course(s) will be approved immediately under your name.
              {batch.rejected_count > 0 && (
                <> The {batch.rejected_count} already-rejected course(s) will be left untouched.</>
              )}
            </p>
          </div>
          <Button
            size="sm" variant="outline"
            className="text-amber-700 dark:text-amber-300 border-amber-400 dark:border-amber-500/50 shrink-0"
            disabled={actionLoading === 'publish'}
            onClick={() => {
              if (!onPublish) return
              runAction('publish', () => onPublish(batch.id))
              setPublishConfirm(false)
            }}
          >
            {actionLoading === 'publish' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Rocket className="h-3 w-3 mr-1" />}
            Confirm Publish
          </Button>
          <Button
            size="sm" variant="outline"
            className="shrink-0"
            onClick={() => setPublishConfirm(false)}
          >
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
        </div>
      )}

      {/* Delete batch confirm */}
      {deleteConfirm && (
        <div className="px-4 py-3 border-t bg-red-50 dark:bg-red-900/10 flex items-center gap-3" onClick={e => e.stopPropagation()}>
          <p className="flex-1 text-sm text-red-700 dark:text-red-400">
            This will permanently delete all {batch.total_entries} course(s) in this batch. Continue?
          </p>
          <Button size="sm" variant="outline" className="text-red-600 border-red-600"
            disabled={actionLoading === 'delete_batch'}
            onClick={() => {
              runAction('delete_batch', () => onDelete(batch.id))
              setDeleteConfirm(false)
            }}
          >
            {actionLoading === 'delete_batch' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
        </div>
      )}

      {/* Deletion requested banner */}
      {(batch as any).review_notes?.startsWith('[DELETE_REQUESTED]') && (
        <div className="px-4 py-2.5 border-t bg-orange-50 dark:bg-orange-900/10 flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" />
          <p className="flex-1 text-xs text-orange-700 dark:text-orange-400">
            <span className="font-semibold">Deletion Requested</span>
            {' — '}{(batch as any).review_notes.replace('[DELETE_REQUESTED] ', '')}
          </p>
          {isAcademicHead && (
            <Button size="sm" variant="outline" className="text-red-600 border-red-600 h-6 text-xs"
              disabled={actionLoading === 'delete_batch'}
              onClick={() => {
                runAction('delete_batch', () => onDelete(batch.id))
              }}
            >
              {actionLoading === 'delete_batch' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
              Approve & Delete
            </Button>
          )}
        </div>
      )}

      {/* Error */}
      {actionError && (
        <div className="px-4 py-2 border-t text-xs text-red-600 bg-red-50 dark:bg-red-900/20">
          {actionError}
        </div>
      )}

      {/* Expanded course list */}
      {expanded && (
        <div className="border-t bg-muted/10">
          {loadingCourses ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading courses…
            </div>
          ) : !courses || courses.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground space-y-1">
              <p>No courses found in this batch.</p>
              {batch.total_entries > 0 && (
                <p className="text-xs">
                  {batch.upload_status === 'deleted'
                    ? `The ${batch.total_entries} course(s) recorded here were deleted along with this batch.`
                    : `The ${batch.total_entries} course(s) recorded here were later updated by a newer upload and are now listed under that batch.`}
                </p>
              )}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Code</th>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Dept</th>
                  <th className="text-center px-4 py-2 font-medium">Y / T</th>
                  <th className="text-center px-4 py-2 font-medium">Units</th>
                  <th className="text-center px-4 py-2 font-medium">Mode</th>
                  <th className="text-center px-4 py-2 font-medium">Status</th>
                  {canEditCourses && <th className="text-center px-4 py-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {courses.map(c => (
                  <Fragment key={c.id}>
                    <tr className="hover:bg-muted/20">
                      <td className="px-4 py-1.5 font-mono">{c.course_code}</td>
                      <td className="px-4 py-1.5">{c.course_name}</td>
                      <td className="px-4 py-1.5 text-muted-foreground">{c.department_code}</td>
                      <td className="px-4 py-1.5 text-center">Y{c.year_level} / T{c.term}</td>
                      <td className="px-4 py-1.5 text-center">{c.units}</td>
                      <td className="px-4 py-1.5 text-center capitalize">{c.delivery_mode}</td>
                      <td className="px-4 py-1.5 text-center">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${COURSE_STATUS_COLORS[c.approval_status] ?? ''}`}>
                          {c.approval_status}
                        </span>
                      </td>
                      {canEditCourses && (
                        <td className="px-4 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isAcademicHead && c.approval_status === 'rejected' && (
                              <button
                                className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/20 text-muted-foreground hover:text-green-600"
                                title="Override: approve this rejected course"
                                disabled={overridingCourseId === c.id}
                                onClick={() => handleCourseOverride(c.id)}
                              >
                                {overridingCourseId === c.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <ShieldCheck className="h-3 w-3" />}
                              </button>
                            )}
                            <button
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Edit course"
                              onClick={() => setEditingCourse(c)}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600"
                              title="Delete course"
                              onClick={() => setDeleteConfirmCourseId(c.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {c.rejection_reason && (c.approval_status === 'rejected' || c.approval_status === 'sent_back') && (
                      <tr className="bg-red-50/50 dark:bg-red-900/10">
                        <td colSpan={canEditCourses ? 8 : 7} className="px-4 py-1 pb-1.5">
                          <span className="text-[11px] text-red-600 dark:text-red-400">
                            <span className="font-medium">Reason: </span>{c.rejection_reason}
                          </span>
                        </td>
                      </tr>
                    )}
                    {deleteConfirmCourseId === c.id && (
                      <tr className="bg-red-50 dark:bg-red-900/10">
                        <td colSpan={canEditCourses ? 8 : 7} className="px-4 py-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-red-700 dark:text-red-400 flex-1">
                              Delete <strong>{c.course_code}</strong>? This cannot be undone.
                            </span>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-600 h-6 text-xs"
                              disabled={deletingCourseId === c.id}
                              onClick={() => handleCourseDelete(c.id)}
                            >
                              {deletingCourseId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 text-xs"
                              onClick={() => setDeleteConfirmCourseId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Course edit modal — self-contained inside BatchRow */}
      <CourseFormModal
        open={!!editingCourse}
        onClose={() => setEditingCourse(null)}
        onSubmit={handleCourseUpdate}
        editingCourse={editingCourse}
        isAcademicHead={isAcademicHead}
        onDelete={async (id) => {
          await handleCourseDelete(id)
          setEditingCourse(null)
          return {}
        }}
      />
    </div>
  )
}

// ── Main list component ────────────────────────────────────────
