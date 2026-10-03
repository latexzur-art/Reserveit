'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Loader2, X, Check, XCircle, ExternalLink, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface RescheduleRequest {
  id: string
  status: string
  reason: string
  attachment_url?: string | null
  created_at: string
  proposed_date: string
  proposed_start_time: string
  proposed_end_time: string
  original_date: string
  original_start_time: string
  original_end_time: string
  extra_amount_centavos: number
  review_notes?: string | null
  user?: { full_name: string; email: string } | null
  booking?: {
    booking_reference: string
    booking_date: string
    start_time: string
    end_time: string
    booking_facilities?: Array<{ facilities?: { name?: string } | null }> | null
  } | null
}

interface Props {
  requestId: string
  onClose: () => void
  onResolved: () => void
}

function durationLabel(start: string, end: string): string {
  const [sh, sm] = (start ?? '').slice(0, 5).split(':').map(Number)
  const [eh, em] = (end ?? '').slice(0, 5).split(':').map(Number)
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

export function ReviewEmergencyRescheduleModal({ requestId, onClose, onResolved }: Props) {
  const { toast } = useToast()
  const [req, setReq] = useState<RescheduleRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState<'approve' | 'decline'>('approve')
  const [reviewNotes, setReviewNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/admin/building/emergency-reschedule-requests?status=all&limit=100')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const found = (data?.requests ?? []).find((r: any) => r.id === requestId)
        if (found) setReq(found)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [requestId])

  const facilityName = req?.booking?.booking_facilities?.[0]?.facilities?.name ?? 'Facility'
  const origDuration = req ? durationLabel(req.original_start_time, req.original_end_time) : '—'
  const propDuration = req ? durationLabel(req.proposed_start_time, req.proposed_end_time) : '—'
  const extraPeso = req ? (req.extra_amount_centavos / 100).toFixed(2) : '0.00'

  const handleSubmit = async () => {
    if (decision === 'decline' && reviewNotes.trim().length < 5) return
    setSubmitting(true)
    try {
      const url = `/api/admin/building/emergency-reschedule-requests/${requestId}/${decision}`
      const body = decision === 'approve'
        ? { review_notes: reviewNotes.trim() || undefined }
        : { review_notes: reviewNotes.trim() }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')

      toast({
        title: decision === 'approve' ? 'Reschedule Approved' : 'Reschedule Declined',
        description: data.message,
      })
      onResolved()
      onClose()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0D0F12] rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D0F12] relative z-10 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              REVIEW <span className="text-accent-brand">RESCHEDULE REQUEST</span>
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : !req ? (
          <div className="flex items-center justify-center p-12 text-slate-400 text-sm">Request not found.</div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {/* User info */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-[10px] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-black uppercase tracking-widest">Submitted By</span>
                  <span className="font-black text-slate-900 dark:text-white">{req.user?.full_name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-black uppercase tracking-widest">Email</span>
                  <span className="text-slate-600 dark:text-slate-400">{req.user?.email ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-black uppercase tracking-widest">Reference</span>
                  <span className="font-black text-slate-900 dark:text-white">{req.booking?.booking_reference ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-black uppercase tracking-widest">Facility</span>
                  <span className="text-slate-600 dark:text-slate-400">{facilityName}</span>
                </div>
              </div>

              {/* Schedule comparison */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Schedule Comparison</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Original</p>
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{req.original_date}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {req.original_start_time?.slice(0, 5)} – {req.original_end_time?.slice(0, 5)}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-1">{origDuration}</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 border border-amber-200 dark:border-amber-500/30">
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">Proposed</p>
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{req.proposed_date}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {req.proposed_start_time?.slice(0, 5)} – {req.proposed_end_time?.slice(0, 5)}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-1">{propDuration}</p>
                  </div>
                </div>
              </div>

              {/* Extra charge */}
              {req.extra_amount_centavos > 0 ? (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Extra Charge</span>
                    <span className="text-sm font-black text-amber-700 dark:text-amber-300">₱{extraPeso}</span>
                  </div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    User will be asked to pay this via PayMongo after approval.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-green-700 dark:text-green-400">No Extra Charge</p>
                </div>
              )}

              {/* User's reason */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">User's Reason</p>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{req.reason}</p>
                </div>
                {req.attachment_url && (
                  <a
                    href={req.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> View Supporting Document
                  </a>
                )}
              </div>

              {/* Decision tabs */}
              <div className="space-y-3">
                <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setDecision('approve')}
                    className={cn(
                      'flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5',
                      decision === 'approve'
                        ? 'bg-green-500 text-white'
                        : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <Check className="w-3 h-3" /> Approve
                  </button>
                  <button
                    onClick={() => setDecision('decline')}
                    className={cn(
                      'flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border-l border-slate-200 dark:border-slate-700',
                      decision === 'decline'
                        ? 'bg-red-500 text-white'
                        : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <XCircle className="w-3 h-3" /> Decline
                  </button>
                </div>

                {/* Notes field */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                    {decision === 'decline' ? (
                      <>Reason for Declining <span className="text-red-500">*</span></>
                    ) : (
                      <>Admin Note (optional)</>
                    )}
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    rows={3}
                    placeholder={decision === 'decline'
                      ? 'Explain why the reschedule request is being declined...'
                      : 'Optional note for the user...'
                    }
                    className={cn(
                      'w-full resize-none rounded-xl border px-4 py-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all',
                      decision === 'decline' && reviewNotes.trim().length > 0 && reviewNotes.trim().length < 5
                        ? 'border-red-300 dark:border-red-500 focus:ring-red-200'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-blue-200 dark:focus:ring-blue-500/20'
                    )}
                  />
                  {decision === 'decline' && (
                    <p className={cn('text-[10px]', reviewNotes.trim().length < 5 ? 'text-red-400' : 'text-slate-400')}>
                      {reviewNotes.trim().length} / minimum 5 characters required
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-3 flex gap-3 shrink-0 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                className="flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-slate-700"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                className={cn(
                  'flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg',
                  decision === 'approve'
                    ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20'
                    : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                )}
                onClick={handleSubmit}
                disabled={submitting || (decision === 'decline' && reviewNotes.trim().length < 5)}
              >
                {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                {submitting ? 'Processing...' : decision === 'approve' ? 'Approve Reschedule' : 'Decline Reschedule'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
