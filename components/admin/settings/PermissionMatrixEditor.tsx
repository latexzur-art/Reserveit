'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS } from '@/backend/admin/admin.types'

interface PermissionMatrixEditorProps {
  permissions: Record<string, string[]>
  onChange: (permissions: Record<string, string[]>) => void
  disabled?: boolean
}

const resourceLabels: Record<string, string> = {
  facilities: 'Facilities',
  bookings: 'Bookings',
  users: 'Users',
  equipment: 'Equipment',
  reports: 'Reports',
}

const actionLabels: Record<string, string> = {
  create: 'Create',
  read: 'Read',
  update: 'Update',
  delete: 'Delete',
  approve: 'Approve',
}

export const PermissionMatrixEditor = ({
  permissions,
  onChange,
  disabled = false,
}: PermissionMatrixEditorProps) => {
  const isChecked = (resource: string, action: string) => {
    return permissions[resource]?.includes(action) ?? false
  }

  const toggle = (resource: string, action: string) => {
    const current = permissions[resource] || []
    const updated = current.includes(action)
      ? current.filter(a => a !== action)
      : [...current, action]

    onChange({
      ...permissions,
      [resource]: updated,
    })
  }

  const toggleRow = (resource: string) => {
    const current = permissions[resource] || []
    const allActions = [...PERMISSION_ACTIONS]
    const allChecked = allActions.every(a => current.includes(a))

    onChange({
      ...permissions,
      [resource]: allChecked ? [] : allActions,
    })
  }

  const toggleColumn = (action: string) => {
    const allResources = [...PERMISSION_RESOURCES]
    const allChecked = allResources.every(r => permissions[r]?.includes(action))

    const updated = { ...permissions }
    for (const resource of allResources) {
      const current = updated[resource] || []
      if (allChecked) {
        updated[resource] = current.filter(a => a !== action)
      } else if (!current.includes(action)) {
        updated[resource] = [...current, action]
      }
    }
    onChange(updated)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Resource</th>
            {PERMISSION_ACTIONS.map(action => (
              <th key={action} className="text-center py-2 px-2 font-medium text-muted-foreground">
                <button
                  type="button"
                  className="hover:text-foreground transition-colors disabled:pointer-events-none"
                  onClick={() => toggleColumn(action)}
                  disabled={disabled}
                  title={`Toggle all ${actionLabels[action]}`}
                >
                  {actionLabels[action]}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_RESOURCES.map(resource => (
            <tr key={resource} className="border-b border-border/50">
              <td className="py-2.5 pr-4">
                <button
                  type="button"
                  className="font-medium hover:text-primary transition-colors disabled:pointer-events-none"
                  onClick={() => toggleRow(resource)}
                  disabled={disabled}
                  title={`Toggle all for ${resourceLabels[resource]}`}
                >
                  {resourceLabels[resource]}
                </button>
              </td>
              {PERMISSION_ACTIONS.map(action => (
                <td key={action} className="text-center py-2.5 px-2">
                  <Checkbox
                    checked={isChecked(resource, action)}
                    onCheckedChange={() => toggle(resource, action)}
                    disabled={disabled}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
