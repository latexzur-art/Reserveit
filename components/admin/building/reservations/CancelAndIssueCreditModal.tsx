'use client'

import { useState, useEffect } from 'react'
import { Wallet, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  bookingId: string
  bookingRef: string
  facilityName: string
  onConfirm: (amountCentavos: number, reason?: string) => Promise<void>
  onClose: () => void
}

export function CancelAndIssueCreditModal({ bookingId, bookingRef, facilityName, onConfirm, onClose }: Props) {
  const [defaultAmountCentavos, setDefaultAmountCentavos] = useState<number>(0)
  const [amountInput, setAmountInput] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingAmount, setLoadingAmount] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/building/bookings/${bookingId}/payment-total`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const total = data?.totalCentavos ?? 0
        setDefaultAmountCentavos(total)
        setAmountInput((total / 100).toFixed(2))
      })
      .catch(() => setAmountInput('0.00'))
      .finally(() => setLoadingAmount(false))
  }, [bookingId])

  const parsedCentavos = Math.round(parseFloat(amountInput || '0') * 100)
  const isValid = parsedCentavos > 0

  const handleConfirm = async () => {
    if (!isValid) return
    setSubmitting(true)
    await onConfirm(parsedCentavos, reason.trim() || undefined)
    setSubmitting(false)
  }

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="bg-white dark:bg-[#0D0F12] rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
              Cancel & Issue Credit
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Booking info */}
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-[10px] space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500 font-black uppercase tracking-widest">Booking</span>
              <span className="font-black text-slate-900 dark:text-white">{bookingRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-black uppercase tracking-widest">Facility</span>
              <span className="text-slate-700 dark:text-slate-300">{facilityName}</span>
            </div>
          </div>

          {/* Policy notice */}
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
            <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">
              This will <strong>cancel the booking</strong> and credit the user's account. No PayMongo refund will be processed.
            </p>
          </div>

          {/* Credit amount */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center justify-between">
              Credit Amount
              <button
                onClick={() => setAmountInput((defaultAmountCentavos / 100).toFixed(2))}
                className="text-blue-500 hover:text-blue-600 font-black text-[9px] uppercase tracking-widest"
              >
                Reset to Full
              </button>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">₱</span>
              {loadingAmount ? (
                <div className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-400 flex items-center">
                  <Loader2 className="w-3 h-3 animate-spin mr-2" /> Loading...
                </div>
              ) : (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-500/40"
                />
              )}
            </div>
            <p className="text-[9px] text-slate-400">Defaults to full completed payment. Adjustable for partial credits.</p>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Facility unavailable due to emergency maintenance"
              className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-500/40"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-slate-700"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
            onClick={handleConfirm}
            disabled={submitting || !isValid || loadingAmount}
          >
            {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
            {submitting ? 'Processing...' : 'Confirm Cancel & Credit'}
          </Button>
        </div>
      </div>
    </div>
  )
}
