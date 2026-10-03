'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { nextRequestStatuses } from '@/lib/equipment/assignment-request-policy'
import { equipmentRequestStatusLabel } from '@/lib/enum-labels'

interface Request {
  id: string
  equipmentCode: string | null
  fromFacilityName: string | null
  toFacilityName: string | null
  requestedByName: string | null
  reason: string | null
  status: string
  statusNote: string | null
}

export default function ITRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/equipment-assignment-requests')
      const data = await res.json()
      setRequests(data.requests || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/equipment-assignment-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast({ title: `Request ${equipmentRequestStatusLabel(status)}` })
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      toast({ title: 'Error', description: d.error || 'Update failed', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Assignment <span className="text-accent-brand">Requests</span>
          </h1>
          <p className="text-sm text-muted-foreground">Building Admin requests to move tech equipment. Approve, process, then complete to apply the move.</p>
        </div>
        <Button variant="outline" className="h-11" onClick={load}><RefreshCw size={16} className="mr-1.5" /> Refresh</Button>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Move</TableHead>
              <TableHead>Requested by</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                <Loader2 className="inline animate-spin mr-2" size={16} /> Loading…
              </TableCell></TableRow>
            ) : requests.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No assignment requests.</TableCell></TableRow>
            ) : requests.map((r) => {
              const next = nextRequestStatuses(r.status)
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.equipmentCode || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(r.fromFacilityName || 'Storage')} → <span className="text-foreground font-medium">{r.toFacilityName || '—'}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.requestedByName || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[16rem] truncate">{r.reason || '—'}</TableCell>
                  <TableCell><Badge variant="secondary">{equipmentRequestStatusLabel(r.status)}</Badge></TableCell>
                  <TableCell className="text-right">
                    {next.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Select onValueChange={(v) => updateStatus(r.id, v)}>
                        <SelectTrigger className="h-9 w-[150px] ml-auto"><SelectValue placeholder="Advance…" /></SelectTrigger>
                        <SelectContent>
                          {next.map((s) => <SelectItem key={s} value={s}>{equipmentRequestStatusLabel(s)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
