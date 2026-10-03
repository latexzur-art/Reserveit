'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  buildIssueReportPayload, roomsFromClasses, type ScheduleRoom,
} from '@/lib/equipment/report-form'

const CATEGORIES = [
  { value: 'broken', label: 'Broken' },
  { value: 'missing', label: 'Missing' },
  { value: 'malfunction', label: 'Malfunction' },
  { value: 'other', label: 'Other' },
]

// Sentinels — Radix Select values must be non-empty strings.
const ROOM_OTHER = '__other__'
const EQUIP_NONE = '__none__'

interface FacilityEquipment {
  id: string
  equipmentCode: string | null
  equipmentName: string | null
  isTech: boolean
}

interface Props {
  /** Optional custom trigger; defaults to an outline button. */
  trigger?: React.ReactNode
  className?: string
}

/**
 * Professor-facing dialog to file an equipment issue report. The room comes
 * from the reporter's class schedule (no reservation required), and picking the
 * specific item lets the server route the escalation to the right office
 * (non-tech -> PAMO, tech -> IT Admin). Routes to the Building Admin triage
 * queue; escalation happens there.
 */
export function ReportEquipmentIssue({ trigger, className }: Props) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('')
  const [roomValue, setRoomValue] = useState('')
  const [equipmentValue, setEquipmentValue] = useState(EQUIP_NONE)
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const [rooms, setRooms] = useState<ScheduleRoom[]>([])
  const [roomsLoaded, setRoomsLoaded] = useState(false)
  const [equipment, setEquipment] = useState<FacilityEquipment[]>([])
  const [equipmentLoading, setEquipmentLoading] = useState(false)
  const { toast } = useToast()

  // Load the reporter's rooms from their class schedule the first time they open.
  useEffect(() => {
    if (!open || roomsLoaded) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/schedules/my-classes')
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setRooms(roomsFromClasses(data.classes ?? []))
        }
      } catch {
        /* fall back to free-text room entry */
      } finally {
        if (!cancelled) setRoomsLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [open, roomsLoaded])

  // Load equipment for the chosen room so the reporter can pick the exact item.
  useEffect(() => {
    if (!roomValue || roomValue === ROOM_OTHER) {
      setEquipment([])
      return
    }
    let cancelled = false
    setEquipmentLoading(true)
    setEquipmentValue(EQUIP_NONE)
    ;(async () => {
      try {
        const res = await fetch(`/api/facilities/${roomValue}/equipment`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setEquipment(data.equipment ?? [])
        }
      } catch {
        if (!cancelled) setEquipment([])
      } finally {
        if (!cancelled) setEquipmentLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [roomValue])

  const reset = () => {
    setCategory(''); setRoomValue(''); setEquipmentValue(EQUIP_NONE)
    setLocation(''); setDescription(''); setEquipment([])
  }

  const submit = async () => {
    if (!category || !description) return
    setSaving(true)
    const facilityId = roomValue && roomValue !== ROOM_OTHER ? roomValue : undefined
    const equipmentId = equipmentValue && equipmentValue !== EQUIP_NONE ? equipmentValue : undefined
    const payload = buildIssueReportPayload({
      category,
      description,
      facilityId,
      equipmentId,
      location: roomValue === ROOM_OTHER ? location : undefined,
    })
    const res = await fetch('/api/equipment-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      toast({ title: 'Report submitted', description: 'Building Admin will review it.' })
      reset(); setOpen(false)
    } else {
      const d = await res.json().catch(() => ({}))
      toast({ title: 'Error', description: d.error || 'Submit failed', variant: 'destructive' })
    }
  }

  const isOtherRoom = roomValue === ROOM_OTHER

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className={className}>
            <AlertTriangle size={16} className="mr-1.5" /> Report equipment issue
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Report an equipment issue</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Issue type</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Room</Label>
            <Select value={roomValue} onValueChange={setRoomValue}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={rooms.length ? 'Select one of your rooms' : 'Select room'} />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => <SelectItem key={r.facilityId} value={r.facilityId}>{r.label}</SelectItem>)}
                <SelectItem value={ROOM_OTHER}>Other / not listed</SelectItem>
              </SelectContent>
            </Select>
            {roomsLoaded && rooms.length === 0 && !isOtherRoom && (
              <p className="text-xs text-muted-foreground">
                No rooms found on your schedule — choose “Other / not listed” to type the room.
              </p>
            )}
          </div>

          {isOtherRoom && (
            <div className="space-y-1.5">
              <Label htmlFor="loc">Room / equipment code</Label>
              <Input
                id="loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Room 301 · PROJ-002"
                className="h-11"
              />
            </div>
          )}

          {!isOtherRoom && roomValue && (
            <div className="space-y-1.5">
              <Label>Equipment (optional)</Label>
              <Select value={equipmentValue} onValueChange={setEquipmentValue} disabled={equipmentLoading}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={equipmentLoading ? 'Loading…' : 'Whole room / not sure'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EQUIP_NONE}>Whole room / not sure</SelectItem>
                  {equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {[e.equipmentCode, e.equipmentName].filter(Boolean).join(' · ')}
                      {e.isTech ? ' (tech)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's wrong?" rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); reset() }} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !category || !description}>
            {saving && <Loader2 size={16} className="mr-1.5 animate-spin" />} Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
