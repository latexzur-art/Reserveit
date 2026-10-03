'use client'

import { useState } from 'react'
import type { BatchWithCourses, Course } from '@/types/course.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'

interface BatchReviewPanelProps {
  batch: BatchWithCourses
  onApprove: (batchId: string) => Promise<{ error?: string }>
  onRejectRows: (batchId: string, courseIds: string[], reason: string) => Promise<{ error?: string }>
  onRejectBatch: (batchId: string, reason: string) => Promise<{ error?: string }>
  onSendBack: (batchId: string, notes: string) => Promise<{ error?: string }>
  onDone: () => void
}

export function BatchReviewPanel({ batch, onApprove, onRejectRows, onRejectBatch, onSendBack, onDone }: BatchReviewPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [rejectReason, setRejectReason] = useState('')
  const [sendBackNotes, setSendBackNotes] = useState('')
  const [showRejectModal, setShowRejectModal] = useState<'rows' | 'batch' | null>(null)
  const [showSendBackModal, setShowSendBackModal] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const pendingCourses = batch.courses.filter(c => c.approval_status === 'pending')

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === pendingCourses.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingCourses.map(c => c.id)))
    }
  }

  const handleApprove = async () => {
    setProcessing(true)
    setError('')
    const res = await onApprove(batch.id)
    if (res.error) setError(res.error)
    else onDone()
    setProcessing(false)
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    setProcessing(true)
    setError('')
    let res
    if (showRejectModal === 'batch') {
      res = await onRejectBatch(batch.id, rejectReason)
    } else {
      res = await onRejectRows(batch.id, Array.from(selectedIds), rejectReason)
    }
    if (res.error) setError(res.error)
    else { setShowRejectModal(null); onDone() }
    setProcessing(false)
  }

  const handleSendBack = async () => {
    if (!sendBackNotes.trim()) return
    setProcessing(true)
    setError('')
    const res = await onSendBack(batch.id, sendBackNotes)
    if (res.error) setError(res.error)
    else { setShowSendBackModal(false); onDone() }
    setProcessing(false)
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="font-medium">{batch.department_name ?? 'Unknown Dept'}</h3>
          <p className="text-xs text-muted-foreground">
            Submitted by {batch.uploader_name} | {batch.total_entries} courses | {batch.upload_mode}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowSendBackModal(true)}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Send Back
          </Button>
          <Button size="sm" variant="outline" className="text-red-600" onClick={() => setShowRejectModal(selectedIds.size > 0 ? 'rows' : 'batch')}>
            <XCircle className="h-3.5 w-3.5 mr-1" /> {selectedIds.size > 0 ? `Reject Selected (${selectedIds.size})` : 'Reject Batch'}
          </Button>
          <Button size="sm" onClick={handleApprove} disabled={processing}>
            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve All
          </Button>
        </div>
      </div>

      {error && <div className="px-4 py-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20">{error}</div>}

      {/* Course list */}
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="px-4 py-2 w-10">
              <input type="checkbox" checked={selectedIds.size === pendingCourses.length && pendingCourses.length > 0} onChange={toggleAll} />
            </th>
            <th className="text-left px-4 py-2">Code</th>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-center px-4 py-2">Units</th>
            <th className="text-center px-4 py-2">Y/T</th>
            <th className="text-center px-4 py-2">Mode</th>
            <th className="text-center px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {batch.courses.map(course => (
            <tr key={course.id} className={selectedIds.has(course.id) ? 'bg-primary/5' : 'hover:bg-muted/20'}>
              <td className="px-4 py-2">
                {course.approval_status === 'pending' && (
                  <input type="checkbox" checked={selectedIds.has(course.id)} onChange={() => toggleSelect(course.id)} />
                )}
              </td>
              <td className="px-4 py-2 font-mono text-xs">{course.course_code}</td>
              <td className="px-4 py-2">{course.course_name}</td>
              <td className="px-4 py-2 text-center">{course.units}</td>
              <td className="px-4 py-2 text-center text-xs">Y{course.year_level}/T{course.term}</td>
              <td className="px-4 py-2 text-center"><Badge variant="outline" className="text-xs capitalize">{course.delivery_mode}</Badge></td>
              <td className="px-4 py-2 text-center">
                <Badge variant={course.approval_status === 'approved' ? 'default' : course.approval_status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                  {course.approval_status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold">{showRejectModal === 'batch' ? 'Reject Entire Batch' : `Reject ${selectedIds.size} Course(s)`}</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRejectModal(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || processing}>
                {processing ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Send back modal */}
      {showSendBackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold">Send Back for Revision</h3>
            <textarea
              value={sendBackNotes}
              onChange={e => setSendBackNotes(e.target.value)}
              placeholder="Enter revision notes for the Program Head..."
              className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSendBackModal(false)}>Cancel</Button>
              <Button onClick={handleSendBack} disabled={!sendBackNotes.trim() || processing}>
                {processing ? 'Sending...' : 'Send Back'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
