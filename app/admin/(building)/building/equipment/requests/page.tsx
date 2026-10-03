'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { equipmentRequestStatusLabel } from '@/lib/enum-labels'

interface Request {
  id: string
  equipmentCode: string | null
  toFacilityName: string | null
  reason: string | null
  status: string
  statusNote: string | null
}

interface Option { id: string; label: string }

export default function BuildingRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [techItems, setTechItems] = useState<Option[]>([])
  const [facilities, setFacilities] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [equipmentId, setEquipmentId] = useState('')
  const [toFacilityId, setToFacilityId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
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

  const loadFormData = useCallback(async () => {
    const [eqRes, facRes] = await Promise.all([
      fetch('/api/admin/building/equipment?pageSize=500'),
      fetch('/api/facilities'),
    ])
    if (eqRes.ok) {
      const d = await eqRes.json()
      setTechItems(
        (d.equipment || [])
          .filter((e: any) => e.managedBy === 'it')
          .map((e: any) => ({ id: e.id, label: `${e.equipmentCode} · ${e.equipmentName}` })),
      )
    }
    if (facRes.ok) {
      const d = await facRes.json()
      setFacilities((d.facilities || []).map((f: any) => ({ id: f.id, label: f.name })))
    }
  }, [])

  useEffect(() => { load(); loadFormData() }, [load, loadFormData])

  const submit = async () => {
    if (!equipmentId || !toFacilityId) return
    setSaving(true)
    const res = await fetch('/api/equipment-assignment-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipmentId, toFacilityId, reason: reason || null }),
    })
    setSaving(false)
    if (res.ok) {
      toast({ title: 'Request submitted' })
      setEquipmentId(''); setToFacilityId(''); setReason(''); setOpen(false)
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      toast({ title: 'Error', description: d.error || 'Submit failed', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Assignment <span className="text-accent-brand">Requests</span>
          </h1>
          <p className="text-sm text-muted-foreground">Request IT Admin to move a tech item to a room. Track approval + progress here.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11" onClick={load}><RefreshCw size={16} className="mr-1.5" /> Refresh</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="h-11"><Plus size={16} className="mr-1.5" /> New request</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Request tech assignment</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Tech item</Label>
                  <Select value={equipmentId} onValueChange={setEquipmentId}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select tech equipment" /></SelectTrigger>
                    <SelectContent>
                      {techItems.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Assign to room</Label>
                  <Select value={toFacilityId} onValueChange={setToFacilityId}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select facility" /></SelectTrigger>
                    <SelectContent>
                      {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-11" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={submit} disabled={saving || !equipmentId || !toFacilityId}>
                  {saving && <Loader2 size={16} className="mr-1.5 animate-spin" />} Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>To room</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                <Loader2 className="inline animate-spin mr-2" size={16} /> Loading…
              </TableCell></TableRow>
            ) : requests.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No requests yet.</TableCell></TableRow>
            ) : requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.equipmentCode || '—'}</TableCell>
                <TableCell className="text-sm">{r.toFacilityName || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[14rem] truncate">{r.reason || '—'}</TableCell>
                <TableCell><Badge variant="secondary">{equipmentRequestStatusLabel(r.status)}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.statusNote || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
