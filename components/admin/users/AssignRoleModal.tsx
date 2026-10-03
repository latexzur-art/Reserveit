'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'
import type { User, RoleOption } from '@/backend/admin/admin.types'
import { roleColors } from '@/backend/admin/admin.types'
import { userRoleLabel } from '@/lib/enum-labels'

interface AssignRoleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  onSubmit: (id: string, roleId: string, note?: string) => void
  roles: RoleOption[]
}

export const AssignRoleModal = ({ open, onOpenChange, user, onSubmit, roles }: AssignRoleModalProps) => {
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [note, setNote] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (user) {
      setSelectedRoleId(user.roleId)
      setNote('')
      setShowConfirm(false)
    }
  }, [user])

  const handleSubmit = () => {
    if (!user || !selectedRoleId || selectedRoleId === user.roleId) return

    if (!showConfirm) {
      setShowConfirm(true)
      return
    }

    onSubmit(user.id, selectedRoleId, note.trim() || undefined)
    onOpenChange(false)
  }

  if (!user) return null

  const currentRole = roles.find(r => r.id === user.roleId)
  const newRole = roles.find(r => r.id === selectedRoleId)
  const hasChanged = selectedRoleId !== user.roleId

  // Filter roles based on user type
  const availableRoles = roles.filter(r => {
    if (user.type === 'Internal') return r.name !== 'external_client'
    return r.name === 'external_client'
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Assign Role</DialogTitle>
          <DialogDescription>
            Change the role for {user.firstName} {user.lastName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Current Role</Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${roleColors[user.role] || ''} border text-sm px-3 py-1`}>
                {userRoleLabel(user.role)}
              </Badge>
              {hasChanged && newRole && (
                <>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className={`${roleColors[newRole.displayName] || ''} border text-sm px-3 py-1`}>
                    {newRole.displayName}
                  </Badge>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>New Role</Label>
            <Select value={selectedRoleId} onValueChange={(v) => { setSelectedRoleId(v); setShowConfirm(false) }}>
              <SelectTrigger>
                <SelectValue placeholder="Select new role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map(role => (
                  <SelectItem key={role.id} value={role.id} disabled={role.id === user.roleId}>
                    {role.displayName} {role.id === user.roleId && '(current)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for role change..."
              className="resize-none"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">This note will be recorded in the audit trail.</p>
          </div>

          {showConfirm && hasChanged && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Are you sure you want to change the role from <strong>{user.role}</strong> to <strong>{newRole?.displayName}</strong>?
                This will affect the user&apos;s permissions immediately.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!hasChanged}>
            {showConfirm ? 'Confirm Change' : 'Apply Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
