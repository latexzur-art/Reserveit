'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Loader2, X, Check, XCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface EmergencyRequest {
  id: string
  status: string
  reason: string
  attachment_url?: string | null
  created_at: string
  completed_payment_centavos?: number
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

export function ReviewEmergencyRequestModal({ requestId, onClose, onResolved }: Props) {
  const { toast } = useToast()
  const [req, setReq] = useState<EmergencyRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState<'approve' | 'deny'>('approve')
  const [amountInput, setAmountInput] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/emergency-cancellation-requests?status=all`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const found = (data?.requests ?? []).find((r: any) => r.id === requestId)
        if (found) {
          setReq(found)
          setAmountInput(((found.completed_payment_centavos ?? 0) / 100).toFixed(2))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [requestId])

  const parsedCentavos = Math.round(parseFloat(amountInput || '0') * 100)
  const maxCentavos = req?.completed_payment_centavos ?? 0

  const handleSubmit = async () => {
    if (decision === 'approve' && parsedCentavos < 0) return
    if (decision === 'deny' && reviewNotes.trim().length < 5) return

    setSubmitting(true)
    try {
      const url = `/api/admin/emergency-cancellation-requests/${requestId}/${decision}`
      const body = decision === 'approve'
        ? { amount_centavos: parsedCentavos, review_notes: reviewNotes.trim() || undefined }
        : { review_notes: reviewNotes.trim() }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')

      toast({
        title: decision === 'approve' ? 'Request Approved' : 'Request Denied',
        description: data.message,
      })
      onResolved()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      setSubmitting(false)
    }
  }

  const facilityName = req?.booking?.booking_facilities?.[0]?.facilities?.name ?? 'Facility'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0D0F12] rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
              Review Emergency Request
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : !req ? (
            <p className="text-sm text-slate-500 text-center py-8">Request not found.</p>
          ) : (
            <>
              {/* Booking info */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-[10px] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-black uppercase tracking-widest">User</span>
                  <span className="text-slate-700 dark:text-slate-300">{req.user?.full_name} · {req.user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-black uppercase tracking-widest">Booking</span>
                  <span className="font-black text-slate-900 dark:text-white">{req.booking?.booking_reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-black uppercase tracking-widest">Facility</span>
                  <span className="text-slate-700 dark:text-slate-300">{facilityName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-black uppercase tracking-widest">Date</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {req.booking?.booking_date} · {req.booking?.start_time?.slice(0, 5)} – {req.booking?.end_time?.slice(0, 5)}
                  </span>
                </div>
                {maxCentavos > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-black uppercase tracking-widest">Paid</span>
                    <span className="font-black text-amber-600 dark:text-amber-400">₱{(maxCentavos / 100).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* User's reason */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                  User's Reason
                </p>
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200 italic">"{req.reason}"</p>
                </div>
                {req.attachment_url && (
                  <a
                    href={req.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600"
                  >
                    <ExternalLink className="w-3 h-3" /> View Attachment
                  </a>
                )}
              </div>

              {/* Decision */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Decision</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDecision('approve')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all',
                      decision === 'approve'
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-green-400'
                    )}
                  >
                    <Check className="w-3 h-3" /> Approve
                  </button>
                </div>
              </div>

              {/* Credit amount (approve only) */}
              {decision === 'approve' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    Credit Amount
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setAmountInput('0')}
                        className="text-red-400 text-[9px] font-black uppercase tracking-widest hover:text-red-500"
                      >
                        No Credit
                      </button>
                      <button
                        onClick={() => setAmountInput((maxCentavos / 100).toFixed(2))}
                        className="text-blue-500 text-[9px] font-black uppercase tracking-widest hover:text-blue-600"
                      >
                        Full Amount
                      </button>
                    </div>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">₱</span>
                    <input
                      type="number"
                      min="0"
                      max={(maxCentavos / 100).toFixed(2)}
                      step="0.01"
                      value={amountInput}
                      onChange={e => setAmountInput(e.target.value)}
                      className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                  </div>
                  {parsedCentavos === 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                      Booking will be cancelled with no credit issued to the user.
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                  Notes to User {decision === 'deny' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder={decision === 'approve' ? 'Optional approval note...' : 'Required: reason for denial...'}
                  className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-500/20"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {req && !loading && (
          <div className="px-6 pb-6 flex gap-3 flex-shrink-0 border-t border-slate-200 dark:border-slate-800 pt-4">
            <Button
              variant="outline"
              className="flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-slate-700"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                (decision === 'approve' && parsedCentavos < 0) ||
                (decision === 'deny' && reviewNotes.trim().length < 5)
              }
              className={cn(
                'flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg',
                decision === 'approve'
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/20'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'
              )}
            >
              {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
              {submitting ? 'Processing...' : decision === 'approve'
                ? (parsedCentavos > 0 ? 'Approve & Issue Credit' : 'Cancel — No Credit')
                : 'Deny Request'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
