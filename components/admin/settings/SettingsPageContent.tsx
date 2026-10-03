'use client'

import { Building2, Shield, AlertTriangle, AlertOctagon } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { GeneralSettings, EmergencySettings, RoleDetail } from '@/backend/admin/admin.types'
import { GeneralSettingsTab } from './GeneralSettingsTab'
import { RolesPermissionsTab } from './RolesPermissionsTab'
import { EmergencySettingsTab, type EmergencySettingsUpdate } from './EmergencySettingsTab'
import { DangerZoneTab } from './DangerZoneTab'

interface SettingsPageContentProps {
  roles: RoleDetail[]
  settings: GeneralSettings
  emergencySettings: EmergencySettings
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
  onUpdateSettings: (updates: Partial<GeneralSettings>) => Promise<void>
  onUpdateEmergencySettings: (updates: EmergencySettingsUpdate) => Promise<void>
}

export const SettingsPageContent = ({
  roles,
  settings,
  emergencySettings,
  saving,
  onCreateRole,
  onUpdateRole,
  onDeactivateRole,
  onUpdateSettings,
  onUpdateEmergencySettings,
}: SettingsPageContentProps) => {
  return (
    <Tabs defaultValue="general" className="space-y-6">
      <TabsList>
        <TabsTrigger value="general" className="gap-1.5">
          <Building2 className="h-4 w-4" />
          General & Branding
        </TabsTrigger>
        <TabsTrigger value="roles" className="gap-1.5">
          <Shield className="h-4 w-4" />
          Roles & Permissions
        </TabsTrigger>
        <TabsTrigger value="emergency" className="gap-1.5">
          <AlertTriangle className="h-4 w-4" />
          Emergency
        </TabsTrigger>
        <TabsTrigger value="danger" className="gap-1.5 text-red-600 dark:text-red-400 hover:bg-destructive/10">
          <AlertOctagon className="h-4 w-4" />
          Danger Zone
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralSettingsTab
          settings={settings}
          saving={saving}
          onSave={onUpdateSettings}
        />
      </TabsContent>

      <TabsContent value="roles">
        <RolesPermissionsTab
          roles={roles}
          saving={saving}
          onCreateRole={onCreateRole}
          onUpdateRole={onUpdateRole}
          onDeactivateRole={onDeactivateRole}
        />
      </TabsContent>

      <TabsContent value="emergency">
        <EmergencySettingsTab
          settings={emergencySettings}
          saving={saving}
          onSave={onUpdateEmergencySettings}
        />
      </TabsContent>

      <TabsContent value="danger">
        <DangerZoneTab />
      </TabsContent>
    </Tabs>
  )
}
