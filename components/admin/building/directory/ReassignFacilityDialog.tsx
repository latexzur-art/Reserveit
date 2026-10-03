'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowRight } from 'lucide-react'
import { useMaintenanceStaffMutations } from '@/hooks/admin/building/useBuildingDirectory'
import type { FacilityAssignmentSummary } from '@/backend/admin/building/building.types'

interface Facility { id: string; name: string; code: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffId: string
  fromFacility: FacilityAssignmentSummary
  onSuccess: () => void
}

export function ReassignFacilityDialog({ open, onOpenChange, staffId, fromFacility, onSuccess }: Props) {
  const { reassign, reassigning } = useMaintenanceStaffMutations()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [toFacilityId, setToFacilityId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setToFacilityId('')
    setLoading(true)
    fetch('/api/admin/building/facilities')
      .then(r => r.json())
      .then(data => setFacilities((data.facilities || data.data || []).filter((f: any) => f.id !== fromFacility.facilityId && f.isActive !== false)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, fromFacility.facilityId])

  const handleReassign = async () => {
    if (!toFacilityId) return
    const ok = await reassign(staffId, fromFacility.facilityId, toFacilityId)
    if (ok) onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reassign Facility</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-0.5">Moving from</p>
            <p className="font-medium">{fromFacility.facilityName}</p>
            <p className="text-xs font-mono text-muted-foreground">{fromFacility.facilityCode}</p>
          </div>
          <div className="flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label>Assign to</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading facilities...
              </div>
            ) : (
              <Select value={toFacilityId} onValueChange={setToFacilityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new facility..." />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name} ({f.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleReassign} disabled={reassigning || !toFacilityId}>
              {reassigning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reassign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
