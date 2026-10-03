'use client'

import { useState } from 'react'
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
import { PermissionMatrixEditor } from './PermissionMatrixEditor'

interface CreateRoleModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    name: string
    displayName: string
    description: string
    badgeColor: string
    isInternalOnly: boolean
    permissions: Record<string, string[]>
  }) => Promise<void>
  saving: boolean
}

const toSnakeCase = (str: string) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

export const CreateRoleModal = ({ open, onClose, onSubmit, saving }: CreateRoleModalProps) => {
  const [displayName, setDisplayName] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [badgeColor, setBadgeColor] = useState('gray')
  const [isInternalOnly, setIsInternalOnly] = useState(true)
  const [permissions, setPermissions] = useState<Record<string, string[]>>({})
  const [autoName, setAutoName] = useState(true)

  const reset = () => {
    setDisplayName('')
    setName('')
    setDescription('')
    setBadgeColor('gray')
    setIsInternalOnly(true)
    setPermissions({})
    setAutoName(true)
  }

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value)
    if (autoName) setName(toSnakeCase(value))
  }

  const handleNameChange = (value: string) => {
    setName(value)
    setAutoName(false)
  }

  const handleSubmit = async () => {
    await onSubmit({ name, displayName, description, badgeColor, isInternalOnly, permissions })
    reset()
    onClose()
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) { reset(); onClose() }
  }

  const isValid = name.trim() && displayName.trim()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Role</DialogTitle>
          <DialogDescription>Define a new role with permissions.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cr-displayName">Display Name</Label>
              <Input
                id="cr-displayName"
                value={displayName}
                onChange={e => handleDisplayNameChange(e.target.value)}
                placeholder="Building Admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-name">System Name</Label>
              <Input
                id="cr-name"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="building_admin"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Snake_case identifier used internally.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cr-description">Description</Label>
            <Textarea
              id="cr-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Manages building facilities and room bookings."
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
                  id="cr-internal"
                  checked={isInternalOnly}
                  onCheckedChange={v => setIsInternalOnly(v === true)}
                />
                <Label htmlFor="cr-internal" className="font-normal">Internal users only</Label>
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
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
