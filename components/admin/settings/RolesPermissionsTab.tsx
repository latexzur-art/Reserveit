'use client'

import { useState } from 'react'
import { Plus, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RoleDetail } from '@/backend/admin/admin.types'
import { RolesTable } from './RolesTable'
import { CreateRoleModal } from './CreateRoleModal'
import { EditRoleModal } from './EditRoleModal'
import { DeactivateRoleDialog } from './DeactivateRoleDialog'

interface RolesPermissionsTabProps {
  roles: RoleDetail[]
  saving: boolean
  onCreateRole: (data: {
    name: string
    displayName: string
    description: string
    badgeColor: string
    isInternalOnly: boolean
    permissions: Record<string, string[]>
  }) => Promise<void>
  onUpdateRole: (id: string, updates: {
    displayName?: string
    description?: string
    badgeColor?: string
    isInternalOnly?: boolean
    permissions?: Record<string, string[]>
    isActive?: boolean
  }) => Promise<void>
  onDeactivateRole: (id: string) => Promise<void>
}

export const RolesPermissionsTab = ({
  roles,
  saving,
  onCreateRole,
  onUpdateRole,
  onDeactivateRole,
}: RolesPermissionsTabProps) => {
  const [createOpen, setCreateOpen] = useState(false)
  const [editRole, setEditRole] = useState<RoleDetail | null>(null)
  const [deactivateRole, setDeactivateRole] = useState<RoleDetail | null>(null)

  const handleDeactivateConfirm = async () => {
    if (deactivateRole) {
      await onDeactivateRole(deactivateRole.id)
      setDeactivateRole(null)
    }
  }

  const handleReactivate = async (role: RoleDetail) => {
    await onUpdateRole(role.id, { isActive: true })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">Roles</h3>
            <p className="text-sm text-muted-foreground">
              {roles.filter(r => r.isActive).length} active role{roles.filter(r => r.isActive).length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Create Role
        </Button>
      </div>

      <RolesTable
        roles={roles}
        onEdit={setEditRole}
        onDeactivate={setDeactivateRole}
        onReactivate={handleReactivate}
      />

      <CreateRoleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreateRole}
        saving={saving}
      />

      <EditRoleModal
        open={!!editRole}
        role={editRole}
        onClose={() => setEditRole(null)}
        onSubmit={onUpdateRole}
        saving={saving}
      />

      <DeactivateRoleDialog
        open={!!deactivateRole}
        role={deactivateRole}
        onConfirm={handleDeactivateConfirm}
        onCancel={() => setDeactivateRole(null)}
      />
    </div>
  )
}
