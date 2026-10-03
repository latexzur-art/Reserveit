'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface ScorePayload {
  count: number
  threshold: number
  status: 'good' | 'warning' | 'restricted'
  accountStatus: string
  pendingRequest: { id: string; createdAt: string } | null
}

const STATUS_META: Record<ScorePayload['status'], { label: string; className: string; Icon: typeof ShieldCheck }> = {
  good: {
    label: 'Good',
    className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    Icon: ShieldCheck,
  },
  warning: {
    label: 'Warning',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    Icon: AlertTriangle,
  },
  restricted: {
    label: 'Restricted',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    Icon: ShieldAlert,
  },
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export const ReliabilityDropdownSection = () => {
  const { toast } = useToast()
  const [data, setData] = useState<ScorePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchScore = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users/reliability-score')
      if (!res.ok) throw new Error('Failed to load reliability score')
      const json = (await res.json()) as ScorePayload
      setData(json)
    } catch (err) {
      console.error('[ReliabilityDropdownSection] fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchScore()
  }, [fetchScore])

  const handleSubmit = async () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      toast({ title: 'Reason required', description: 'Please briefly explain your request.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/users/reliability-score/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error ?? 'Failed to submit request')
      }
      toast({
        title: 'Reset request submitted',
        description: 'The Academic Head will review your request shortly.',
      })
      setDialogOpen(false)
      setReason('')
      await fetchScore()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit request'
      toast({ title: 'Submission failed', description: message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="px-2 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading score…
      </div>
    )
  }

  if (!data) return null

  const meta = STATUS_META[data.status]
  const Icon = meta.Icon
  const hint =
    data.status === 'restricted'
      ? 'Your account is restricted. Contact the Building Admin.'
      : data.status === 'warning'
        ? 'One more cancellation will restrict your account.'
        : null

  return (
    <>
      <div className="px-2 py-2 border-t border-border/60 mt-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
            <Icon className="h-3 w-3" /> Reliability
          </span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${meta.className}`}>
            {meta.label}
          </Badge>
        </div>
        <div className="mt-1 text-sm font-medium text-foreground">
          {data.count} / {data.threshold}{' '}
          <span className="text-xs font-normal text-muted-foreground">cancellations</span>
        </div>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{hint}</p>}
        {data.pendingRequest ? (
          <p className="mt-2 text-[11px] text-muted-foreground italic">
            Reset request pending · submitted {formatRelative(data.pendingRequest.createdAt)}
          </p>
        ) : data.count > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full h-7 text-xs"
            onClick={() => setDialogOpen(true)}
          >
            Request reset
          </Button>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Request Score Reset</DialogTitle>
            <DialogDescription>
              Briefly explain why you would like the Academic Head to reset your cancellation counter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The cancellations were due to a scheduling conflict outside my control…"
              maxLength={500}
              rows={5}
            />
            <p className="text-[11px] text-muted-foreground text-right">{reason.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />} Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
