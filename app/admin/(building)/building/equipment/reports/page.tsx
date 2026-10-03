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
import { equipmentReportCategoryLabel, equipmentReportStatusLabel } from '@/lib/enum-labels'

interface Report {
  id: string
  equipmentCode: string | null
  facilityName: string | null
  category: string
  description: string
  status: string
  isTech: boolean
  reportedByName: string | null
}

const TRIAGE_STATUSES = ['under_process', 'resolved', 'still_broken', 'escalated']

export default function BuildingReportsTriagePage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/equipment-reports')
      const data = await res.json()
      setReports(data.reports || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const patchReport = async (id: string, body: Record<string, unknown>, okTitle: string) => {
    const res = await fetch(`/api/equipment-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast({ title: okTitle })
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      toast({ title: 'Error', description: d.error || 'Update failed', variant: 'destructive' })
    }
  }

  const updateStatus = (id: string, status: string) =>
    patchReport(id, { status }, status === 'escalated' ? 'Escalated to owning office' : 'Report updated')

  // Correct routing for a report with no equipment item to derive scope from,
  // before escalating it (server accepts the isTech override for building_admin).
  const updateScope = (id: string, status: string, isTech: boolean) =>
    patchReport(id, { status, isTech }, isTech ? 'Routed to IT Admin' : 'Routed to PAMO')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Reports <span className="text-accent-brand">Triage</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            All equipment issue reports. Escalate routes to the owning office — non-tech → PAMO, tech → IT Admin.
          </p>
        </div>
        <Button variant="outline" className="h-11" onClick={load}><RefreshCw size={16} className="mr-1.5" /> Refresh</Button>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Reported by</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Triage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                <Loader2 className="inline animate-spin mr-2" size={16} /> Loading…
              </TableCell></TableRow>
            ) : reports.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No reports.</TableCell></TableRow>
            ) : reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.equipmentCode || '—'}</TableCell>
                <TableCell>
                  <Select value={r.isTech ? 'tech' : 'nontech'} onValueChange={(v) => updateScope(r.id, r.status, v === 'tech')}>
                    <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nontech">non-tech</SelectItem>
                      <SelectItem value="tech">tech</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.facilityName || '—'}</TableCell>
                <TableCell className="max-w-xs">
                  <div className="flex flex-col gap-0.5">
                    <Badge variant="outline" className="w-fit text-[11px]">{equipmentReportCategoryLabel(r.category)}</Badge>
                    <span className="text-sm text-muted-foreground truncate">{r.description}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.reportedByName || '—'}</TableCell>
                <TableCell><Badge variant="secondary">{equipmentReportStatusLabel(r.status)}</Badge></TableCell>
                <TableCell className="text-right">
                  <Select onValueChange={(v) => updateStatus(r.id, v)}>
                    <SelectTrigger className="h-9 w-[150px] ml-auto"><SelectValue placeholder="Set…" /></SelectTrigger>
                    <SelectContent>
                      {TRIAGE_STATUSES.map((s) => <SelectItem key={s} value={s}>{equipmentReportStatusLabel(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
