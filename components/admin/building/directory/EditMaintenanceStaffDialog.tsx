'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useMaintenanceStaffMutations } from '@/hooks/admin/building/useBuildingDirectory'
import type { DirectoryPersonDetail } from '@/backend/admin/building/building.types'

const SPECIALIZATIONS = ['General', 'HVAC', 'Electrical', 'Plumbing', 'Carpentry', 'Painting', 'Cleaning', 'IT/Technical']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: DirectoryPersonDetail
  onSuccess: () => void
}

export function EditMaintenanceStaffDialog({ open, onOpenChange, detail, onSuccess }: Props) {
  const { update, updating } = useMaintenanceStaffMutations()
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    position: '',
    specialization: '',
    hireDate: '',
    notes: '',
  })

  useEffect(() => {
    setForm({
      fullName: detail.name ?? '',
      email: detail.email ?? '',
      phone: detail.phone ?? '',
      position: detail.position ?? 'Maintenance Technician',
      specialization: detail.specialization ?? '',
      hireDate: detail.hireDate ?? '',
      notes: detail.notes ?? '',
    })
  }, [detail])

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async () => {
    const result = await update(detail.id, {
      fullName: form.fullName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      position: form.position,
      specialization: form.specialization || undefined,
      hireDate: form.hireDate || undefined,
      notes: form.notes.trim() || undefined,
    })
    if (result) {
      onSuccess()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {detail.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={form.fullName} onChange={e => set('fullName', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Position</Label>
            <Input value={form.position} onChange={e => set('position', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Specialization</Label>
              <Select value={form.specialization} onValueChange={v => set('specialization', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALIZATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hire Date</Label>
              <Input type="date" value={form.hireDate} onChange={e => set('hireDate', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={updating || !form.fullName.trim()}>
              {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
