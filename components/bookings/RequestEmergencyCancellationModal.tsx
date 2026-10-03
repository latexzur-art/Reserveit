'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, X, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  bookingRef: string
  facilityName: string
  bookingDate: string
  bookingTime: string
  paidAmountPeso?: string
  requiresPayment?: boolean
  helpdeskPhone?: string
  helpdeskEmail?: string
  onSubmit: (reason: string, attachmentUrl?: string) => Promise<boolean>
  onClose: () => void
}

export function RequestEmergencyCancellationModal({
  bookingRef,
  facilityName,
  bookingDate,
  bookingTime,
  paidAmountPeso,
  requiresPayment = true,
  helpdeskPhone,
  helpdeskEmail,
  onSubmit,
  onClose,
}: Props) {
  const [reason, setReason] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const isFormValid = reason.trim().length >= 10 && (!requiresPayment || agreed)

  const handleSubmit = async () => {
    if (!isFormValid || submitting) return
    setSubmitting(true)
    try {
      const success = await onSubmit(reason.trim(), attachmentUrl.trim() || undefined)
      if (success) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        role="dialog"
        aria-labelledby="emergency-modal-title"
        className="bg-white dark:bg-slate-950 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 id="emergency-modal-title" className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Request Emergency Cancellation
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Booking info summary card */}
          <div className="bg-slate-50 dark:bg-slate-900/80 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Reference</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">{bookingRef}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Facility</span>
              <span className="text-slate-700 dark:text-slate-200 font-medium">{facilityName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Date & Time</span>
              <span className="text-slate-700 dark:text-slate-200 font-medium">{bookingDate} · {bookingTime}</span>
            </div>
            {paidAmountPeso && (
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Amount Paid</span>
                <span className="text-slate-900 dark:text-white font-bold">₱{paidAmountPeso}</span>
              </div>
            )}
          </div>

          {/* Integrated Policy & Helpdesk Notice Box */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                Emergency Cancellation Policy
              </span>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              {requiresPayment ? (
                <>Reservations are <strong>non-refundable</strong>. Submitting a request sends it for building admin review (resolution may be <strong>session credit</strong>, no credit, or a reschedule).</>
              ) : (
                <>Submitting this request will notify the building admin for review and potential reschedule options.</>
              )}
            </p>

            {(helpdeskPhone || helpdeskEmail) && (
              <div className="pt-2 border-t border-amber-500/20 flex flex-wrap gap-2 text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium self-center">Need immediate assistance?</span>
                {helpdeskPhone && (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    📞 {helpdeskPhone}
                  </span>
                )}
                {helpdeskEmail && (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    ✉ {helpdeskEmail}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Reason Input Field */}
          <div className="space-y-1.5">
            <label 
              htmlFor="cancellation-reason" 
              className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center justify-between"
            >
              <span>Reason for Cancellation <span className="text-red-500">*</span></span>
              <span className={cn(
                'text-xs font-medium transition-colors',
                reason.trim().length === 0
                  ? 'text-slate-400 dark:text-slate-500'
                  : reason.trim().length < 10
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              )}>
                {reason.trim().length} / 10 min characters
              </span>
            </label>
            <textarea
              id="cancellation-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Please describe your emergency situation in detail..."
              className={cn(
                'w-full resize-none rounded-xl border px-4 py-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all',
                reason.trim().length > 0 && reason.trim().length < 10
                  ? 'border-amber-300 dark:border-amber-500 focus:ring-amber-200 dark:focus:ring-amber-500/20'
                  : 'border-slate-200 dark:border-slate-800 focus:ring-blue-200 dark:focus:ring-blue-500/20'
              )}
            />
          </div>

          {/* Optional Attachment URL */}
          <div className="space-y-1.5">
            <label 
              htmlFor="attachment-url"
              className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
            >
              <Paperclip className="w-3.5 h-3.5 text-slate-400" /> Supporting Document URL (optional)
            </label>
            <input
              id="attachment-url"
              type="url"
              value={attachmentUrl}
              onChange={e => setAttachmentUrl(e.target.value)}
              placeholder="https://drive.google.com/... (e.g. medical certificate)"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/20 transition-all"
            />
          </div>

          {/* Agreement Checkbox */}
          {requiresPayment && (
            <label className="flex items-start gap-3 cursor-pointer group pt-1">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 accent-blue-600 w-4 h-4 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                I understand that the original payment will <strong>not be refunded</strong> to my card. The building admin will determine the final resolution.
              </span>
            </label>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl text-xs font-bold uppercase tracking-wider border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-11 rounded-xl text-xs font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            onClick={handleSubmit}
            disabled={submitting || !isFormValid}
            title={!isFormValid ? 'Please enter at least 10 characters and confirm acknowledgement' : 'Submit emergency request'}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {submitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </div>
    </div>
  )
}

