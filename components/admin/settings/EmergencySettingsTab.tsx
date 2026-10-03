'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { EmergencySettings } from '@/backend/admin/admin.types'

export interface EmergencySettingsUpdate {
  emergency_helpdesk_phone?: string
  emergency_reschedule_message_template?: string
  emergency_decline_response_template?: string
  emergency_cancel_message_template?: string
}

interface EmergencySettingsTabProps {
  settings: EmergencySettings
  saving: boolean
  onSave: (updates: EmergencySettingsUpdate) => Promise<void>
}

export const EmergencySettingsTab = ({ settings, saving, onSave }: EmergencySettingsTabProps) => {
  const [form, setForm] = useState<EmergencySettings>(settings)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setForm(settings)
    setDirty(false)
  }, [settings])

  const handleChange = (key: keyof EmergencySettings, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    const updates: EmergencySettingsUpdate = {}
    if (form.helpdeskPhone !== settings.helpdeskPhone) {
      updates.emergency_helpdesk_phone = form.helpdeskPhone
    }
    if (form.rescheduleTemplate !== settings.rescheduleTemplate) {
      updates.emergency_reschedule_message_template = form.rescheduleTemplate
    }
    if (form.declineTemplate !== settings.declineTemplate) {
      updates.emergency_decline_response_template = form.declineTemplate
    }
    if (form.cancelTemplate !== settings.cancelTemplate) {
      updates.emergency_cancel_message_template = form.cancelTemplate
    }
    if (Object.keys(updates).length > 0) {
      await onSave(updates)
      setDirty(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Emergency Reschedule Configuration</p>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
            These settings control the messaging users see when a paid booking is disrupted by an emergency
            (typhoon, safety incident, etc.). Templates are pre-filled into the admin's proposal — they can still be edited per case.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Helpdesk Contact</CardTitle>
          <CardDescription>
            Phone number shown to users who decline an emergency reschedule or whose booking is on hold.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="emergency_helpdesk_phone">Helpdesk Phone Number</Label>
            <Input
              id="emergency_helpdesk_phone"
              type="tel"
              value={form.helpdeskPhone}
              onChange={e => handleChange('helpdeskPhone', e.target.value)}
              placeholder="(043) 123-4567"
              maxLength={30}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message Templates</CardTitle>
          <CardDescription>
            Default messages sent at each stage of the emergency flow. Admins can override these per case.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emergency_reschedule_message_template">
              Reschedule Proposal Message
            </Label>
            <Textarea
              id="emergency_reschedule_message_template"
              rows={5}
              maxLength={2000}
              value={form.rescheduleTemplate}
              onChange={e => handleChange('rescheduleTemplate', e.target.value)}
              placeholder="Default message explaining why the reschedule is needed..."
              className="resize-none leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">{form.rescheduleTemplate.length}/2000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergency_decline_response_template">
              Decline Response Message
            </Label>
            <Textarea
              id="emergency_decline_response_template"
              rows={5}
              maxLength={2000}
              value={form.declineTemplate}
              onChange={e => handleChange('declineTemplate', e.target.value)}
              placeholder="Message sent to users after they decline the reschedule..."
              className="resize-none leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">{form.declineTemplate.length}/2000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergency_cancel_message_template">
              Refund Cancellation Message
            </Label>
            <Textarea
              id="emergency_cancel_message_template"
              rows={5}
              maxLength={2000}
              value={form.cancelTemplate}
              onChange={e => handleChange('cancelTemplate', e.target.value)}
              placeholder="Message sent when the booking is cancelled with refund..."
              className="resize-none leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">{form.cancelTemplate.length}/2000</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>
    </div>
  )
}
