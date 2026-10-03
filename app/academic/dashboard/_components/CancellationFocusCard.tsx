'use client'

import { useState } from 'react'
import { Loader2, CheckCircle, XCircle, AlertTriangle, Clock, QrCode, Maximize2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CancellationRequest, CancellationRespondAction } from '@/hooks/academic-head/useCancellationRequests'
import { getTimeAgo, formatDate, formatTime } from './cancellation-format'

interface CancellationFocusCardProps {
  request: CancellationRequest
  responding: boolean
  notes: string
  onNotesChange: (value: string) => void
  onRespond: (action: CancellationRespondAction) => void
}

export function CancellationFocusCard({ request: req, responding, notes, onNotesChange, onRespond }: CancellationFocusCardProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null)

  const facility = req.bookings?.booking_facilities?.[0]?.facilities
  const facilityName = facility?.name ?? 'Unknown Facility'
  const isPending = req.status === 'pending'
  const timeAgo = getTimeAgo(req.created_at)

  return (
    <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-bold border",
                isPending
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400"
                  : req.status.includes('approved')
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                    : "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400"
              )}>
                {req.status === 'pending' ? 'Pending' : req.status === 'approved_no_strike' ? 'Approved (No Strike)' : req.status === 'approved_with_strike' ? 'Approved (Strike)' : req.status === 'auto_approved' ? 'Auto-Approved' : 'Rejected'}
              </span>
              {req.refund_destination_name && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-bold border",
                  req.refund_window_met
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400"
                )}>
                  {req.refund_window_met ? 'Full refund if approved' : 'Outside refund window'}
                </span>
              )}
              {req.auto_approved && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Auto-approved after 24h
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-foreground truncate">
              {req.users?.full_name ?? 'Unknown User'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {req.bookings?.booking_reference ?? 'N/A'} &middot; {facilityName} &middot; {formatDate(req.bookings?.booking_date)} &middot; {formatTime(req.bookings?.start_time)}–{formatTime(req.bookings?.end_time)}
            </p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
        </div>

        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Reason</p>
          <p className="text-sm text-foreground leading-relaxed">{req.reason}</p>
        </div>

        {req.refund_destination_name && (
          <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Refund Destination</p>
            <p className="text-sm text-foreground leading-relaxed">
              {req.refund_destination_name}
              {req.refund_destination_contact_number && ` · ${req.refund_destination_contact_number}`}
            </p>

            {req.refund_destination_qr_url && (
              <div className="pt-2 border-t border-slate-200 dark:border-white/5 flex items-center gap-3">
                <div className="relative w-20 h-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-950 p-1 flex items-center justify-center shrink-0 overflow-hidden group shadow-sm">
                  <img
                    src={req.refund_destination_qr_url}
                    alt="Refund QR Code"
                    className="max-w-full max-h-full object-contain rounded transition-transform group-hover:scale-105"
                  />
                  <button
                    type="button"
                    onClick={() => setQrUrl(req.refund_destination_qr_url!)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    title="Expand QR Code"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    Refund QR Reference Attached
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Downsized scannable preview. Click image to scan or expand full size.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQrUrl(req.refund_destination_qr_url!)}
                    className="h-7 px-2 text-[11px] font-medium rounded-lg"
                  >
                    <Maximize2 className="w-3 h-3 mr-1" /> View / Scan Full QR
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {req.review_notes && (
          <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Review Notes</p>
            <p className="text-sm text-foreground leading-relaxed">{req.review_notes}</p>
          </div>
        )}

        {isPending && (
          <div className="mt-4 space-y-3">
            <textarea
              value={notes}
              onChange={e => onNotesChange(e.target.value)}
              placeholder="Optional review notes..."
              rows={2}
              className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-950 text-foreground outline-none focus:border-primary/50 resize-none"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => onRespond('approve_no_strike')}
                disabled={responding}
                className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4"
              >
                {responding ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
                Approve — No Strike
              </Button>
              <Button
                size="sm"
                onClick={() => onRespond('approve_with_strike')}
                disabled={responding}
                className="h-9 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-4"
              >
                {responding ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />}
                Approve — With Strike
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRespond('reject')}
                disabled={responding}
                className="h-9 text-xs font-semibold border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30 rounded-xl px-4"
              >
                {responding ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
                Reject
              </Button>
            </div>
          </div>
        )}
      </div>

      {qrUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setQrUrl(null)}
        >
          <div
            className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-md w-full flex flex-col items-center shadow-2xl relative animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-400" />
                Refund QR Code Reference
              </span>
              <button
                type="button"
                onClick={() => setQrUrl(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-inner flex items-center justify-center max-w-full">
              <img
                src={qrUrl}
                alt="Full Refund QR Code"
                className="max-h-[60vh] max-w-full object-contain rounded"
              />
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center">
              Scan with your GCash or Maya app camera to verify refund destination details.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
