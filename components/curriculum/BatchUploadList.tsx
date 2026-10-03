'use client'

import { useState, useCallback, useMemo, Fragment } from 'react'
import type { CourseUploadBatch, Course, UploadStatus, CourseCreateInput } from '@/types/course.types'
import { Button } from '@/components/ui/button'
import { CourseFormModal } from '@/components/curriculum/CourseFormModal'
import { ChevronDown, ChevronRight, CheckCircle, XCircle, RotateCcw, Send, Loader2, Pencil, Trash2, ShieldCheck, AlertTriangle, User, Rocket, ShieldAlert, X, Search, Filter } from 'lucide-react'

import { BatchRow } from './BatchRow'
import { STATUS_LABELS, STATUS_COLORS } from './batch-constants'

interface BatchUploadListProps {
  batches: any[]
  total: number
  loading: boolean
  isAcademicHead: boolean
  currentUserId?: string
  page: number
  onPageChange: (p: number) => void
  onSubmitBatch: (batchId: string) => Promise<{ error?: string }>
  onApproveBatch: (batchId: string) => Promise<{ error?: string }>
  onRejectBatch: (batchId: string, reason: string) => Promise<{ error?: string }>
  onSendBackBatch: (batchId: string, notes: string) => Promise<{ error?: string }>
  onDeleteBatch: (batchId: string) => Promise<{ error?: string }>
  onRollbackBatch?: (batchId: string) => Promise<{ error?: string }>
  onPublishBatch?: (batchId: string) => Promise<{ error?: string; message?: string }>
  onRequestDeletion?: (batchId: string, reason: string) => Promise<{ error?: string }>
  onRefresh: () => void
}

export function BatchUploadList({
  batches, total, loading, isAcademicHead, currentUserId, page, onPageChange,
  onSubmitBatch, onApproveBatch, onRejectBatch, onSendBackBatch, onDeleteBatch, onRollbackBatch, onPublishBatch, onRequestDeletion, onRefresh,
}: BatchUploadListProps) {
  const limit = 20
  const totalPages = Math.ceil(total / limit)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredBatches = useMemo(() => {
    return batches.filter(batch => {
      const matchesSearch = !search.trim() || 
        (batch.department_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (batch.uploader_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (batch.uploader_notes ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (batch.upload_mode ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || batch.upload_status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [batches, search, statusFilter])

  const allIds = filteredBatches.map(b => b.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const someSelected = selected.size > 0

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    setBulkError('')
    const ids = Array.from(selected)
    const results = await Promise.all(ids.map(id => onDeleteBatch(id)))
    setBulkDeleting(false)
    const failed = results.filter(r => r.error)
    if (failed.length) {
      setBulkError(`${failed.length} batch(es) could not be deleted.`)
    }
    setSelected(new Set())
    setBulkConfirm(false)
    onRefresh()
  }

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="pt-4 pl-4">
              <div className="h-3.5 w-3.5 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
            <div className="flex-1 border rounded-xl p-4 md:p-5 bg-white dark:bg-[#0B0F17] animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-1/4 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (batches.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm">
        No batch uploads yet. Use <span className="font-medium">Upload CSV</span> to get started.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search and Status Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search batches by department, submitter, or notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-10 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-10 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 px-3 font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">All Statuses ({batches.length})</option>
            <option value="approved">Approved</option>
            <option value="submitted">Submitted (Pending Review)</option>
            <option value="draft">Draft / Pending Submission</option>
            <option value="validation_failed">Validation Failed</option>
            <option value="rejected">Rejected</option>
            <option value="partially_rejected">Partially Rejected</option>
          </select>
        </div>
      </div>

      {/* Bulk action toolbar — academic head only */}
      {isAcademicHead && someSelected && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">{selected.size} batch(es) selected</span>
          <div className="flex-1" />
          {bulkConfirm ? (
            <>
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                Delete {selected.size} batch(es) and all their courses?
              </span>
              <Button size="sm" variant="outline" className="h-8 text-xs font-semibold text-red-600 border-red-600 hover:bg-red-100"
                disabled={bulkDeleting}
                onClick={handleBulkDelete}
              >
                {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Confirm Delete
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs font-semibold" onClick={() => setBulkConfirm(false)}>Cancel</Button>
            </>
          ) : (
            <>
              {bulkError && <span className="text-xs text-red-600">{bulkError}</span>}
              <Button size="sm" variant="outline" className="h-8 text-xs font-semibold text-red-600 border-red-300 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => setBulkConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Selected
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs font-semibold" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </>
          )}
        </div>
      )}

      {/* Select-all row */}
      <div className="flex items-center gap-3 px-4 py-1">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 accent-blue-600 cursor-pointer"
          checked={allSelected}
          onChange={toggleAll}
        />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Select all on this page</span>
      </div>

      {filteredBatches.length === 0 ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">
          No batches match your filter criteria.
        </div>
      ) : (
        filteredBatches.map(batch => (
          <div key={batch.id} className="flex items-start gap-3">
            <div className="pt-4 pl-4">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 accent-blue-600 cursor-pointer"
                checked={selected.has(batch.id)}
                onChange={() => toggleOne(batch.id)}
              />
            </div>
            <div className="flex-1 min-w-0">
              <BatchRow
                batch={batch}
                isAcademicHead={isAcademicHead}
                currentUserId={currentUserId}
                onSubmit={onSubmitBatch}
                onApprove={onApproveBatch}
                onReject={onRejectBatch}
                onSendBack={onSendBackBatch}
                onDelete={onDeleteBatch}
                onRollback={onRollbackBatch}
                onPublish={onPublishBatch}
                onRequestDeletion={onRequestDeletion}
                onRefresh={onRefresh}
              />
            </div>
          </div>
        ))
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} batches
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

