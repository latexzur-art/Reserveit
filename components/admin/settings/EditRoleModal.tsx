'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { BADGE_COLOR_OPTIONS } from '@/backend/admin/admin.types'
import type { RoleDetail } from '@/backend/admin/admin.types'
import { PermissionMatrixEditor } from './PermissionMatrixEditor'

interface EditRoleModalProps {
  open: boolean
  role: RoleDetail | null
  onClose: () => void
  onSubmit: (id: string, updates: {
    displayName?: string
    description?: string
    badgeColor?: string
    isInternalOnly?: boolean
    permissions?: Record<string, string[]>
  }) => Promise<void>
  saving: boolean
}

export const EditRoleModal = ({ open, role, onClose, onSubmit, saving }: EditRoleModalProps) => {
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [badgeColor, setBadgeColor] = useState('gray')
  const [isInternalOnly, setIsInternalOnly] = useState(true)
  const [permissions, setPermissions] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (role) {
      setDisplayName(role.displayName)
      setDescription(role.description)
      setBadgeColor(role.badgeColor)
      setIsInternalOnly(role.isInternalOnly)
      setPermissions(role.permissions || {})
    }
  }, [role])

  const handleSubmit = async () => {
    if (!role) return
    await onSubmit(role.id, { displayName, description, badgeColor, isInternalOnly, permissions })
    onClose()
  }

  if (!role) return null

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Role</DialogTitle>
          <DialogDescription>
            Editing <strong>{role.displayName}</strong> ({role.name})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="er-displayName">Display Name</Label>
              <Input
                id="er-displayName"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>System Name</Label>
              <Input value={role.name} disabled className="bg-muted font-mono text-sm" />
              <p className="text-xs text-muted-foreground">System name cannot be changed.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="er-description">Description</Label>
            <Textarea
              id="er-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Badge Color</Label>
              <Select value={badgeColor} onValueChange={setBadgeColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BADGE_COLOR_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full bg-${opt.value}-500`} />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex items-end">
              <div className="flex items-center gap-2 pb-2">
                <Checkbox
                  id="er-internal"
                  checked={isInternalOnly}
                  onCheckedChange={v => setIsInternalOnly(v === true)}
                />
                <Label htmlFor="er-internal" className="font-normal">Internal users only</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="border rounded-md p-3">
              <PermissionMatrixEditor permissions={permissions} onChange={setPermissions} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!displayName.trim() || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
