"use client"

import { useState, useEffect } from 'react'
import { TrendingDown, CheckCircle2, AlertTriangle, XCircle, Clock, Send, RotateCcw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface ReliabilityData {
  count: number
  threshold: number
  status: 'good' | 'warning' | 'restricted'
  accountStatus: string
  isExempt?: boolean
  exemptionReason?: string | null
  pendingRequest: { id: string; createdAt: string } | null
}

export function CancellationRateResetCard() {
  const [data, setData] = useState<ReliabilityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/users/reliability-score')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the reset request.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/users/reliability-score/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit request')
      setData(prev =>
        prev ? { ...prev, pendingRequest: { id: json.requestId, createdAt: json.createdAt } } : prev
      )
      setShowForm(false)
      setReason('')
      toast.success('Reset request submitted. The Building Admin will review it shortly.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not submit request')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Card className="bg-card border border-border/80 rounded-2xl shadow-xs">
        <CardContent className="p-6">
          <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const { count, threshold, status, isExempt, pendingRequest } = data
  const dots = Array.from({ length: threshold }, (_, i) => i < count)

  const statusConfig = {
    good: {
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
      label: 'Good Standing',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    },
    warning: {
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
      label: 'At Risk',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    },
    restricted: {
      icon: <XCircle className="w-3.5 h-3.5 text-rose-500" />,
      label: 'Restricted',
      badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
    },
  }

  const cfg = statusConfig[status]

  return (
    <Card className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-foreground">Cancellation Record</CardTitle>
          </div>
          {isExempt ? (
            <Badge variant="outline" className="text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-blue-500" />
              Policy Exempt
            </Badge>
          ) : (
            <Badge variant="outline" className={`text-xs font-semibold ${cfg.badgeClass}`}>
              <span className="mr-1">{cfg.icon}</span>
              {cfg.label}
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs text-muted-foreground mt-0.5">
          {isExempt
            ? 'External client accounts are exempt from cancellation tracking unless enabled by the Building Administrator.'
            : 'Consecutive cancellations affect your booking priority score.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {isExempt ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-800 dark:text-blue-200">
            <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="font-semibold text-foreground text-xs">Exempt from Priority Restrictions</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                External clients pay per reservation and do not accumulate priority score penalties.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Counter dots */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {dots.map((filled, i) => (
                  <div
                    key={i}
                    className={`w-6 h-6 rounded-md border-2 transition-colors ${
                      filled
                        ? status === 'restricted'
                          ? 'bg-rose-500 border-rose-500'
                          : 'bg-amber-400 border-amber-400'
                        : 'bg-muted border-border'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {count} / {threshold} before restriction
              </span>
            </div>

            {/* Pending request state */}
            {pendingRequest ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Reset Request Pending</p>
                  <p className="text-xs text-blue-600/80 dark:text-blue-300/80">
                    Submitted {new Date(pendingRequest.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })} — awaiting Building Admin review
                  </p>
                </div>
              </div>
            ) : count > 0 ? (
              <>
                {!showForm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowForm(true)}
                    className="w-full sm:w-auto text-xs font-semibold rounded-xl border-border/80"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Request Counter Reset
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 rounded-xl border border-border/80 bg-muted/20">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">
                        Reason for Reset Request
                      </Label>
                      <Textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="Explain why you believe the cancellations should be cleared (e.g., medical emergency, force majeure)..."
                        rows={3}
                        maxLength={500}
                        className="text-xs resize-none rounded-xl border-border/80"
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{reason.length}/500</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={submitting || !reason.trim()}
                        className="text-xs font-semibold rounded-xl"
                      >
                        {submitting ? (
                          <>Submitting…</>
                        ) : (
                          <><Send className="w-3.5 h-3.5 mr-1.5" />Submit Request</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowForm(false); setReason('') }}
                        disabled={submitting}
                        className="text-xs rounded-xl"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No cancellations on record — keep it up.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
