"use client"

import { useState, useEffect } from 'react'
import { Zap, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Factor {
  code: string
  label: string
  points: number
  type: 'positive' | 'negative'
}

const FACTOR_HINTS: Record<string, string> = {
  REQ_HIGH_CANCEL: 'Improves automatically as cancellations age past the 90-day window. Submitting a reset request below asks the Building Admin to clear it.',
  REQ_UNPAID: 'Settle outstanding payment balances to remove this penalty.',
  REQ_VIOLATIONS: 'Contact the Building Admin to review past restrictions.',
}

interface LikelihoodData {
  baselineScore: number
  threshold: number
  likelihood: 'high' | 'moderate' | 'low'
  factors: Factor[]
}

const LIKELIHOOD_CONFIG = {
  high: {
    label: 'High',
    description: 'Most bookings will be auto-approved',
    barColor: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
  moderate: {
    label: 'Moderate',
    description: 'Some bookings may need manual review',
    barColor: 'bg-amber-400',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  low: {
    label: 'Low',
    description: 'Most bookings will be flagged for review',
    barColor: 'bg-red-500',
    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    textColor: 'text-red-600 dark:text-red-400',
  },
}

export function ApprovalLikelihoodCard() {
  const [data, setData] = useState<LikelihoodData | null>(null)
  const [loading, setLoading] = useState(true)

  // Reset request state
  const [pendingRequest, setPendingRequest] = useState<{ id: string; createdAt: string } | null>(null)
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetReason, setResetReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/users/approval-likelihood')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))

    // Load pending request state
    fetch('/api/users/reliability-score')
      .then(r => r.json())
      .then(d => {
        if (d.pendingRequest) setPendingRequest(d.pendingRequest)
      })
      .catch(() => {})
  }, [])

  const handleRequestReset = async () => {
    if (!resetReason.trim()) {
      setResetError('Please provide a reason.')
      return
    }
    setSubmitting(true)
    setResetError(null)
    try {
      const res = await fetch('/api/users/reliability-score/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: resetReason.trim(), type: 'cancellation_rate' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit')
      setPendingRequest({ id: json.requestId, createdAt: json.createdAt })
      setShowResetForm(false)
      setResetReason('')
      setResetSuccess(true)
      setTimeout(() => setResetSuccess(false), 4000)
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Could not submit request')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const { baselineScore, threshold, likelihood, factors } = data
  const cfg = LIKELIHOOD_CONFIG[likelihood]
  const barWidth = `${baselineScore}%`
  const thresholdPos = `${threshold}%`

  const positives = factors.filter(f => f.type === 'positive')
  const negatives = factors.filter(f => f.type === 'negative')

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Auto-Approval Likelihood</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-xs">
                  Based on your profile factors only. The final score for each booking also depends on the facility, timing, and purpose.
                </TooltipContent>
              </Tooltip>
            </div>
            <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest ${cfg.badgeClass}`}>
              {cfg.label}
            </Badge>
          </div>
          <CardDescription className="text-xs">{cfg.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Score bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <span>Baseline Score</span>
              <span className={cfg.textColor}>{baselineScore} / 100</span>
            </div>
            <div className="relative h-2.5 w-full rounded-full bg-muted overflow-visible">
              <div
                className={`h-full rounded-full transition-all duration-700 ${cfg.barColor}`}
                style={{ width: barWidth }}
              />
              {/* Threshold marker */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-foreground/40 rounded-full cursor-help"
                    style={{ left: thresholdPos }}
                  />
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  Auto-approve threshold: {threshold}
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Auto-approve threshold is <span className="font-semibold">{threshold}</span>
              {baselineScore >= threshold
                ? ' — you meet it based on your profile.'
                : ` — you are ${threshold - baselineScore} pts below it from profile factors alone.`}
            </p>
          </div>

          {/* Factors */}
          {factors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Factors</p>
              <div className="space-y-1">
                {positives.map((f, i) => (
                  <div key={i} className="py-1.5 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">{f.label}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+{f.points}</span>
                    </div>
                  </div>
                ))}
                {negatives.map((f, i) => (
                  <div key={i} className="py-1.5 px-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />
                        <span className="text-xs text-red-800 dark:text-red-300 font-medium">{f.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">{f.points}</span>
                        {f.code === 'REQ_HIGH_CANCEL' && (
                          pendingRequest ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full px-2 py-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                              Pending
                            </span>
                          ) : (
                            <button
                              onClick={() => { setShowResetForm(v => !v); setResetError(null) }}
                              className="text-[10px] font-semibold text-red-600 dark:text-red-400 underline underline-offset-2 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                            >
                              Request Reset
                            </button>
                          )
                        )}
                      </div>
                    </div>
                    {FACTOR_HINTS[f.code] && (
                      <p className="mt-1 text-[10px] text-red-600/70 dark:text-red-400/60 leading-snug">
                        {FACTOR_HINTS[f.code]}
                      </p>
                    )}

                    {/* Inline reset form for REQ_HIGH_CANCEL */}
                    {f.code === 'REQ_HIGH_CANCEL' && showResetForm && !pendingRequest && (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={resetReason}
                          onChange={e => { setResetReason(e.target.value); setResetError(null) }}
                          placeholder="Explain why the cancellations should be cleared (e.g., medical emergency, force majeure)…"
                          rows={3}
                          maxLength={500}
                          className="w-full text-xs rounded-md border border-red-200 dark:border-red-800/60 bg-white dark:bg-red-950/20 text-red-900 dark:text-red-200 placeholder:text-red-400/60 p-2 resize-none focus:outline-none focus:ring-1 focus:ring-red-400"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-red-400/70">{resetReason.length}/500</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setShowResetForm(false); setResetReason(''); setResetError(null) }}
                              disabled={submitting}
                              className="text-[10px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleRequestReset}
                              disabled={submitting || !resetReason.trim()}
                              className="text-[10px] font-bold px-3 py-1 rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white transition-colors"
                            >
                              {submitting ? 'Submitting…' : 'Submit Request'}
                            </button>
                          </div>
                        </div>
                        {resetError && (
                          <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">{resetError}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {factors.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Minus className="w-3.5 h-3.5 shrink-0" />
              No profile-based adjustments — score is at the default baseline.
            </div>
          )}

          {/* Success banner */}
          {resetSuccess && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              Reset request submitted — the Building Admin will review it shortly.
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
