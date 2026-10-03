'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { useAdminSettings } from '@/hooks/admin/useAdminSettings'
import { useAdminNotifications } from '@/hooks/admin/useAdminNotifications'
import { useUI } from '@/contexts/UIContext'
import { SettingsPageContent } from '@/components/admin/settings/SettingsPageContent'
import { useToast } from '@/hooks/use-toast'
import { defaultEmergencySettings, type EmergencySettings } from '@/backend/admin/admin.types'
import type { EmergencySettingsUpdate } from '@/components/admin/settings/EmergencySettingsTab'
import { SkeletonList } from "@/components/ui/SkeletonList";


export default function AdminSettings() {
  const { toggleMobileMenu } = useUI()
  const { toast } = useToast()
  const {
    roles, settings, loading, saving,
    createRole, updateRole, deactivateRole, updateSettings,
  } = useAdminSettings()

  const {
    notifications, unreadCount,
    markNotificationRead, markAllNotificationsRead, clearAllNotifications,
  } = useAdminNotifications()

  const [emergencySettings, setEmergencySettings] = useState<EmergencySettings>(defaultEmergencySettings)
  const [emergencyLoading, setEmergencyLoading] = useState(true)
  const [emergencySaving, setEmergencySaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setEmergencyLoading(true)
    fetch('/api/admin/building/emergency-settings')
      .then(async res => {
        if (!res.ok) throw new Error('Failed to load emergency settings')
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setEmergencySettings({
          helpdeskPhone: data.helpdeskPhone ?? '',
          rescheduleTemplate: data.rescheduleTemplate ?? '',
          declineTemplate: data.declineTemplate ?? '',
          cancelTemplate: data.cancelTemplate ?? '',
        })
      })
      .catch(err => {
        if (!cancelled) {
          toast({ title: 'Error', description: err.message, variant: 'destructive' })
        }
      })
      .finally(() => { if (!cancelled) setEmergencyLoading(false) })
    return () => { cancelled = true }
  }, [toast])

  const updateEmergencySettings = useCallback(async (updates: EmergencySettingsUpdate) => {
    setEmergencySaving(true)
    try {
      const res = await fetch('/api/admin/building/emergency-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save emergency settings')
      setEmergencySettings(prev => ({
        helpdeskPhone: updates.emergency_helpdesk_phone ?? prev.helpdeskPhone,
        rescheduleTemplate: updates.emergency_reschedule_message_template ?? prev.rescheduleTemplate,
        declineTemplate: updates.emergency_decline_response_template ?? prev.declineTemplate,
        cancelTemplate: updates.emergency_cancel_message_template ?? prev.cancelTemplate,
      }))
      toast({ title: 'Saved', description: data.message ?? 'Emergency settings updated.' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setEmergencySaving(false)
    }
  }, [toast])

  if (loading || emergencyLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <SkeletonList />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      <main className="px-4 lg:px-6 py-6 space-y-6 flex-1">
        <SettingsPageContent
          roles={roles}
          settings={settings}
          emergencySettings={emergencySettings}
          saving={saving || emergencySaving}
          onCreateRole={createRole}
          onUpdateRole={updateRole}
          onDeactivateRole={deactivateRole}
          onUpdateSettings={updateSettings}
          onUpdateEmergencySettings={updateEmergencySettings}
        />
      </main>
      <footer className="px-4 lg:px-6 py-3 border-t border-border text-xs text-muted-foreground text-right">
        &copy; {new Date().getFullYear()} <span className="text-sti-yellow-muted font-medium">STI</span> Colleges &middot; ReserveIT
      </footer>
    </div>
  )
}
