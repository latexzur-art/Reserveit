'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { Loader2, Check, X } from 'lucide-react'
import { useMaintenanceStaffMutations } from '@/hooks/admin/building/useBuildingDirectory'
import { cn } from '@/lib/utils'

interface Facility { id: string; name: string; code: string; roomNumber: string | null }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffId: string
  existingFacilityIds: string[]
  onSuccess: () => void
}

export function AssignFacilityDialog({ open, onOpenChange, staffId, existingFacilityIds, onSuccess }: Props) {
  const { assignFacilities, assigning } = useMaintenanceStaffMutations()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loadingFacilities, setLoadingFacilities] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected([])
    setLoadingFacilities(true)
    fetch('/api/admin/building/facilities')
      .then(r => r.json())
      .then(data => setFacilities((data.facilities || data.data || []).filter((f: any) => f.isActive !== false)))
      .catch(() => {})
      .finally(() => setLoadingFacilities(false))
  }, [open])

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleAssign = async () => {
    if (!selected.length) return
    const ok = await assignFacilities(staffId, selected)
    if (ok) onSuccess()
  }

  const available = facilities.filter(f => !existingFacilityIds.includes(f.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Facilities</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map(id => {
                const f = facilities.find(x => x.id === id)
                return (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {f?.name ?? id}
                    <button onClick={() => toggle(id)}><X className="w-3 h-3" /></button>
                  </Badge>
                )
              })}
            </div>
          )}
          {loadingFacilities ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Command className="rounded-lg border border-border">
              <CommandInput placeholder="Search facilities..." />
              <CommandList className="max-h-56">
                <CommandEmpty>No facilities found.</CommandEmpty>
                <CommandGroup>
                  {available.map(f => (
                    <CommandItem key={f.id} value={f.name} onSelect={() => toggle(f.id)} className="cursor-pointer">
                      <div className={cn('mr-2 flex h-4 w-4 items-center justify-center rounded border', selected.includes(f.id) ? 'bg-primary border-primary' : 'border-border')}>
                        {selected.includes(f.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{f.code}{f.roomNumber ? ` · ${f.roomNumber}` : ''}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
          {!available.length && !loadingFacilities && (
            <p className="text-xs text-muted-foreground text-center py-2">All facilities are already assigned.</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={assigning || !selected.length}>
              {assigning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign {selected.length > 0 ? `(${selected.length})` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
