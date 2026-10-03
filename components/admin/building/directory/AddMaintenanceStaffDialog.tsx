'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, BadgeCheck } from 'lucide-react'
import { useMaintenanceStaffMutations } from '@/hooks/admin/building/useBuildingDirectory'
import type { MaintenanceStaffMember } from '@/backend/admin/building/building.types'

const SPECIALIZATIONS = ['General', 'HVAC', 'Electrical', 'Plumbing', 'Carpentry', 'Painting', 'Cleaning', 'IT/Technical']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (staff: MaintenanceStaffMember) => void
}

export function AddMaintenanceStaffDialog({ open, onOpenChange, onSuccess }: Props) {
  const { create, creating } = useMaintenanceStaffMutations()
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    position: 'Maintenance Technician',
    specialization: '',
    hireDate: '',
    notes: '',
  })
  const [createdId, setCreatedId] = useState<string | null>(null)

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async () => {
    if (!form.fullName.trim()) return
    const result = await create({
      fullName: form.fullName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      position: form.position,
      specialization: form.specialization || undefined,
      hireDate: form.hireDate || undefined,
      notes: form.notes.trim() || undefined,
    })
    if (result) {
      setCreatedId(result.employeeId)
      onSuccess(result)
    }
  }

  const handleClose = (v: boolean) => {
    if (!v) {
      setForm({ fullName: '', email: '', phone: '', position: 'Maintenance Technician', specialization: '', hireDate: '', notes: '' })
      setCreatedId(null)
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Maintenance Staff</DialogTitle>
        </DialogHeader>

        {createdId ? (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <BadgeCheck className="w-6 h-6 text-green-600" />
            </div>
            <p className="font-semibold text-lg">Staff member added!</p>
            <p className="text-muted-foreground text-sm">Their generated ID is:</p>
            <p className="font-mono font-bold text-2xl text-foreground">{createdId}</p>
            <Button className="mt-2" onClick={() => handleClose(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-red-600 dark:text-red-400">*</span></Label>
              <Input placeholder="e.g. Juan dela Cruz" value={form.fullName} onChange={e => set('fullName', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="Optional" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="09XXXXXXXXX" value={form.phone} onChange={e => set('phone', e.target.value)} />
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
              <Input placeholder="Optional notes" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={creating || !form.fullName.trim()}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Staff
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
