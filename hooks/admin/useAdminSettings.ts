'use client'

import { useState, useCallback, useEffect } from 'react'
import type { GeneralSettings, RoleDetail } from '@/backend/admin/admin.types'
import { defaultGeneralSettings } from '@/backend/admin/admin.types'
import { useToast } from '@/hooks/use-toast'

export const useAdminSettings = () => {
  const [roles, setRoles] = useState<RoleDetail[]>([])
  const [settings, setSettings] = useState<GeneralSettings>(defaultGeneralSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Fetch system settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings({ ...defaultGeneralSettings, ...data.settings })
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }, [])

  // Fetch roles with user counts
  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings/roles')
      if (res.ok) {
        const data = await res.json()
        setRoles(data.roles || [])
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchSettings(), fetchRoles()])
      setLoading(false)
    }
    load()
  }, [fetchSettings, fetchRoles])

  // Update system settings
  const updateSettings = useCallback(async (updates: Partial<GeneralSettings>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updates }),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      setSettings(prev => ({ ...prev, ...updates }))
      toast({ title: 'Settings Saved', description: 'System settings have been updated.' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [toast])

  // Create role
  const createRole = useCallback(async (data: {
    name: string
    displayName: string
    description: string
    badgeColor: string
    isInternalOnly: boolean
    permissions: Record<string, string[]>
  }) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create role')
      }
      toast({ title: 'Role Created', description: `${data.displayName} has been created.` })
      await fetchRoles()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      throw err
    } finally {
      setSaving(false)
    }
  }, [toast, fetchRoles])

  // Update role
  const updateRole = useCallback(async (id: string, updates: {
    displayName?: string
    description?: string
    badgeColor?: string
    isInternalOnly?: boolean
    permissions?: Record<string, string[]>
    isActive?: boolean
  }) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/roles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update role')
      toast({ title: 'Role Updated', description: 'Role has been updated successfully.' })
      await fetchRoles()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      throw err
    } finally {
      setSaving(false)
    }
  }, [toast, fetchRoles])

  // Deactivate role
  const deactivateRole = useCallback(async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/roles/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to deactivate role')
      toast({ title: 'Role Deactivated', description: 'Role has been deactivated.' })
      await fetchRoles()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      throw err
    } finally {
      setSaving(false)
    }
  }, [toast, fetchRoles])

  return {
    roles,
    settings,
    loading,
    saving,
    createRole,
    updateRole,
    deactivateRole,
    updateSettings,
    refreshRoles: fetchRoles,
    refreshSettings: fetchSettings,
  }
}
