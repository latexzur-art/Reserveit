'use client'

import { useState, useEffect } from 'react'
import { labelFor } from '@/lib/enum-labels'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { User, RoleOption, DepartmentOption } from '@/backend/admin/admin.types'

interface EditUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onSubmit: (id: string, updates: {
    fullName?: string
    phone?: string
    departmentId?: string
    organization?: string
    notificationEmail?: string | null
  }) => void
  roles: RoleOption[]
  departments: DepartmentOption[]
}

const userSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
})

export const EditUserModal = ({ open, onOpenChange, user, onSubmit, roles, departments }: EditUserModalProps) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    department: '',
    organization: '',
    notificationEmail: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (user && open) {
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        department: user.departmentId || '',
        organization: user.organization || '',
        notificationEmail: user.notificationEmail || '',
      })
      setErrors({})
      setHasChanges(false)
    }
  }, [user, open])

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      userSchema.parse(formData)
      onSubmit(user.id, {
        fullName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        phone: formData.phone?.trim() || undefined,
        departmentId: formData.department || undefined,
        organization: formData.organization?.trim() || undefined,
        notificationEmail: formData.notificationEmail.trim() || null,
      })
      onOpenChange(false)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.issues.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message
        })
        setErrors(fieldErrors)
      }
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pr-6">
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update profile for {user.firstName} {user.lastName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-firstName">First Name *</Label>
              <Input id="edit-firstName" value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} />
              {errors.firstName && <p className="text-xs text-red-600 dark:text-red-400">{errors.firstName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lastName">Last Name *</Label>
              <Input id="edit-lastName" value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} />
              {errors.lastName && <p className="text-xs text-red-600 dark:text-red-400">{errors.lastName}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input value={user.email} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone Number</Label>
            <Input id="edit-phone" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} />
          </div>

          {user.type === 'Internal' && (
            <div className="space-y-2">
              <Label htmlFor="edit-notificationEmail">Notification Email</Label>
              <Input
                id="edit-notificationEmail"
                type="email"
                placeholder="e.g. user@gmail.com"
                value={formData.notificationEmail}
                onChange={(e) => handleChange('notificationEmail', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Personal inbox (e.g. Gmail) where booking emails are sent, since STI sign-in addresses don't receive external mail.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>User Classification</Label>
            <Input value={labelFor('user_type', user.type)} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={labelFor('user_role', user.role)} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">Use "Assign Role" to change roles</p>
          </div>

          {user.type === 'Internal' ? (
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={formData.department} onValueChange={(v) => handleChange('department', v)}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.code} - {d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="edit-organization">Organization</Label>
              <Input id="edit-organization" value={formData.organization} onChange={(e) => handleChange('organization', e.target.value)} />
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!hasChanges}>Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
