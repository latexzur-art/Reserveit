'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  Search,
  Inbox,
  Loader2,
  Check,
  X,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { formatEnumLabel } from '@/lib/enum-labels'

interface StaffRow {
  id: string
  name: string
  email: string
  departmentCode: string
  departmentName: string
  roles: string[]
  isProgramHead: boolean
  count: number
  accountStatus: string
}

interface PendingRequest {
  id: string
  userId: string
  userName: string
  userEmail: string
  departmentCode: string
  departmentName: string
  roles: string[]
  countAtRequest: number
  resetType: 'consecutive' | 'cancellation_rate'
  reason: string
  createdAt: string
}

interface ReliabilityResponse {
  staff: StaffRow[]
  pendingRequests: PendingRequest[]
}

const THRESHOLD = 3

function statusBadge(count: number, accountStatus: string) {
  if (accountStatus === 'restricted') {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
        <ShieldAlert className="w-3 h-3 mr-1" />
        Restricted
      </Badge>
    )
  }
  if (count >= THRESHOLD - 1) {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Warning
      </Badge>
    )
  }
  return (
    <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
      <ShieldCheck className="w-3 h-3 mr-1" />
      Good
    </Badge>
  )
}

export function StaffReliabilityView() {
  const { toast } = useToast()
  const [data, setData] = useState<ReliabilityResponse>({ staff: [], pendingRequests: [] })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [onlyFlagged, setOnlyFlagged] = useState(false)

  const [resetTarget, setResetTarget] = useState<StaffRow | null>(null)
  const [resetNotes, setResetNotes] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)

  const [decisionTarget, setDecisionTarget] = useState<{ req: PendingRequest; decision: 'approve' | 'decline' } | null>(null)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [decisionSubmitting, setDecisionSubmitting] = useState(false)

  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkNotes, setBulkNotes] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/academic-head/reliability')
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as ReliabilityResponse
      setData(json)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const filteredStaff = useMemo(() => {
    const s = search.toLowerCase()
    return data.staff.filter((row) => {
      if (onlyFlagged && row.count === 0 && row.accountStatus !== 'restricted') return false
      if (!s) return true
      return (
        row.name.toLowerCase().includes(s) ||
        row.email.toLowerCase().includes(s) ||
        row.departmentName.toLowerCase().includes(s) ||
        row.departmentCode.toLowerCase().includes(s)
      )
    })
  }, [data.staff, search, onlyFlagged])

  const submitReset = async () => {
    if (!resetTarget) return
    setResetSubmitting(true)
    try {
      const res = await fetch(`/api/academic-head/reliability/${resetTarget.id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: resetNotes.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Reset failed')
      toast({ title: 'Score reset', description: `${resetTarget.name}'s counter is now 0.` })
      setResetTarget(null)
      setResetNotes('')
      await fetchData()
    } catch (err) {
      toast({
        title: 'Reset failed',
        description: err instanceof Error ? err.message : 'Reset failed',
        variant: 'destructive',
      })
    } finally {
      setResetSubmitting(false)
    }
  }

  const submitDecision = async () => {
    if (!decisionTarget) return
    setDecisionSubmitting(true)
    try {
      const res = await fetch(
        `/api/academic-head/reliability/requests/${decisionTarget.req.id}/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: decisionTarget.decision,
            notes: decisionNotes.trim() || undefined,
          }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Decision failed')
      toast({
        title: decisionTarget.decision === 'approve' ? 'Request approved' : 'Request declined',
        description: `${decisionTarget.req.userName} has been notified.`,
      })
      setDecisionTarget(null)
      setDecisionNotes('')
      await fetchData()
    } catch (err) {
      toast({
        title: 'Decision failed',
        description: err instanceof Error ? err.message : 'Decision failed',
        variant: 'destructive',
      })
    } finally {
      setDecisionSubmitting(false)
    }
  }

  const submitBulk = async () => {
    setBulkSubmitting(true)
    try {
      const res = await fetch('/api/academic-head/reliability/bulk-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'all',
          notes: bulkNotes.trim() || undefined,
          confirm: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Bulk reset failed')
      toast({ title: 'Bulk reset complete', description: `Reset ${json.affected ?? 0} users.` })
      setBulkOpen(false)
      setBulkNotes('')
      await fetchData()
    } catch (err) {
      toast({
        title: 'Bulk reset failed',
        description: err instanceof Error ? err.message : 'Bulk reset failed',
        variant: 'destructive',
      })
    } finally {
      setBulkSubmitting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col space-y-6 p-4 sm:p-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">
            Staff <span className="text-[#FACC15] dark:text-[#0072bc]">Reliability</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-[0.2em]">
            Review cancellation counters and reset requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchData}
            className="h-10 rounded-lg border-slate-200 dark:border-slate-800 dark:bg-[#0B0F17]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setBulkOpen(true)}
            className="h-10 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-lg font-bold"
          >
            <Users className="w-4 h-4 mr-2" />
            Reset All
          </Button>
        </div>
      </div>

      <section className="bg-white dark:bg-[#0B0F17] rounded-xl border border-slate-200 dark:border-slate-800/60 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Pending Reset Requests
          </h2>
          <Badge variant="outline" className="ml-auto">
            {data.pendingRequests.length}
          </Badge>
        </div>
        {loading && data.pendingRequests.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : data.pendingRequests.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No pending requests.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 pr-3 font-bold">Requester</th>
                  <th className="py-2 pr-3 font-bold">Dept</th>
                  <th className="py-2 pr-3 font-bold">Type</th>
                  <th className="py-2 pr-3 font-bold">Reason</th>
                  <th className="py-2 pr-3 font-bold">Submitted</th>
                  <th className="py-2 pr-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.pendingRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                  >
                    <td className="py-3 pr-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{req.userName}</div>
                      <div className="text-[11px] text-muted-foreground">{req.userEmail}</div>
                    </td>
                    <td className="py-3 pr-3">{req.departmentCode}</td>
                    <td className="py-3 pr-3">
                      {req.resetType === 'cancellation_rate' ? (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800 text-[10px]">
                          High Cancel Rate
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-[10px]">
                          {req.countAtRequest}/{THRESHOLD} Consecutive
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 pr-3 max-w-[260px]">
                      <p className="line-clamp-2 text-slate-600 dark:text-slate-300">{req.reason}</p>
                    </td>
                    <td className="py-3 pr-3 text-[11px] text-muted-foreground">
                      {new Date(req.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300"
                          onClick={() => setDecisionTarget({ req, decision: 'approve' })}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
                          onClick={() => setDecisionTarget({ req, decision: 'decline' })}
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Decline
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-[#0B0F17] rounded-xl border border-slate-200 dark:border-slate-800/60 p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              All Teaching Staff
            </h2>
            <Badge variant="outline" className="ml-2">
              {filteredStaff.length}
            </Badge>
          </div>
          <div className="md:ml-auto flex items-center gap-2 w-full md:w-auto">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={onlyFlagged}
                onChange={(e) => setOnlyFlagged(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Only flagged
            </label>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search staff…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>
        </div>
        {loading && data.staff.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading staff…
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No staff match the current filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 pr-3 font-bold">Name</th>
                  <th className="py-2 pr-3 font-bold">Dept</th>
                  <th className="py-2 pr-3 font-bold">Role</th>
                  <th className="py-2 pr-3 font-bold">Count</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 pr-3 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                  >
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{row.name}</div>
                      <div className="text-[11px] text-muted-foreground">{row.email}</div>
                    </td>
                    <td className="py-2.5 pr-3">{row.departmentCode}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {row.roles.map((r) => (
                          <Badge
                            key={r}
                            variant="secondary"
                            className="text-[9px] font-bold capitalize"
                          >
                            {formatEnumLabel(r)}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono">
                      {row.count}/{THRESHOLD}
                    </td>
                    <td className="py-2.5 pr-3">{statusBadge(row.count, row.accountStatus)}</td>
                    <td className="py-2.5 pr-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setResetTarget(row)}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reset single user dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Reset Reliability Score</DialogTitle>
            <DialogDescription>
              {resetTarget && (
                <>
                  Reset <strong>{resetTarget.name}</strong>&apos;s consecutive cancellation counter
                  to 0 and clear their 90-day cancellation rate history. They will be notified by
                  email and in-app.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Optional notes (shown to the user)…"
            value={resetNotes}
            onChange={(e) => setResetNotes(e.target.value)}
            rows={4}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetTarget(null)} disabled={resetSubmitting}>
              Cancel
            </Button>
            <Button onClick={submitReset} disabled={resetSubmitting}>
              {resetSubmitting && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision dialog */}
      <Dialog open={!!decisionTarget} onOpenChange={(o) => !o && setDecisionTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>
              {decisionTarget?.decision === 'approve' ? 'Approve Reset Request' : 'Decline Reset Request'}
            </DialogTitle>
            <DialogDescription>
              {decisionTarget && (
                <>
                  <strong>{decisionTarget.req.userName}</strong> requested a reset of their{' '}
                  {decisionTarget.req.resetType === 'cancellation_rate'
                    ? 'high cancellation rate'
                    : `consecutive cancellation counter (${decisionTarget.req.countAtRequest}/${THRESHOLD})`}
                  . They will be notified by email and in-app.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {decisionTarget && (
            <div className="text-xs bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-md p-3">
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Reason:</p>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {decisionTarget.req.reason}
              </p>
            </div>
          )}
          <Textarea
            placeholder={
              decisionTarget?.decision === 'approve'
                ? 'Optional notes…'
                : 'Reason for declining (shown to the user)…'
            }
            value={decisionNotes}
            onChange={(e) => setDecisionNotes(e.target.value)}
            rows={4}
            maxLength={500}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDecisionTarget(null)}
              disabled={decisionSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={submitDecision} disabled={decisionSubmitting}>
              {decisionSubmitting && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              {decisionTarget?.decision === 'approve' ? 'Approve' : 'Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk reset dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Reset All Teaching Staff</DialogTitle>
            <DialogDescription>
              This will reset the cancellation counter to 0 for every faculty / program head with a
              non-zero count. Restricted users will be moved back to active. Each affected user gets
              an in-app notification; no per-user email is sent.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Optional notes for the audit log…"
            value={bulkNotes}
            onChange={(e) => setBulkNotes(e.target.value)}
            rows={4}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOpen(false)} disabled={bulkSubmitting}>
              Cancel
            </Button>
            <Button onClick={submitBulk} disabled={bulkSubmitting}>
              {bulkSubmitting && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Reset All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
