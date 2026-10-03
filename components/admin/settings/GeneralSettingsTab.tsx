'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { GeneralSettings } from '@/backend/admin/admin.types'

interface GeneralSettingsTabProps {
  settings: GeneralSettings
  saving: boolean
  onSave: (updates: Partial<GeneralSettings>) => Promise<void>
}

export const GeneralSettingsTab = ({ settings, saving, onSave }: GeneralSettingsTabProps) => {
  const [form, setForm] = useState<GeneralSettings>(settings)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setForm(settings)
    setDirty(false)
  }, [settings])

  const handleChange = (key: keyof GeneralSettings, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    // Only send changed fields
    const changes: Partial<GeneralSettings> = {}
    for (const key of Object.keys(form) as (keyof GeneralSettings)[]) {
      if (form[key] !== settings[key]) {
        (changes as any)[key] = form[key]
      }
    }
    if (Object.keys(changes).length > 0) {
      await onSave(changes)
      setDirty(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Institution Information</CardTitle>
          <CardDescription>Basic information about your institution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="institution_name">Institution Name</Label>
              <Input
                id="institution_name"
                value={form.institution_name}
                onChange={e => handleChange('institution_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app_name">Application Name</Label>
              <Input
                id="app_name"
                value={form.app_name}
                onChange={e => handleChange('app_name', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin_contact_email">Admin Contact Email</Label>
              <Input
                id="admin_contact_email"
                type="email"
                value={form.admin_contact_email}
                onChange={e => handleChange('admin_contact_email', e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_contact_phone">Admin Contact Phone</Label>
              <Input
                id="admin_contact_phone"
                type="tel"
                value={form.admin_contact_phone}
                onChange={e => handleChange('admin_contact_phone', e.target.value)}
                placeholder="+63 XXX XXX XXXX"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking Policy &amp; External Clients</CardTitle>
          <CardDescription>Configure policy rules and cancellation tracking for external users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border border-border/80 bg-muted/20 gap-4">
            <div className="space-y-1">
              <Label htmlFor="enforce_external_client_cancellations" className="text-xs font-semibold text-foreground cursor-pointer">
                Enforce Cancellation Tracking for External Clients
              </Label>
              <p className="text-xs text-muted-foreground">
                When disabled (default), external client accounts are exempt from cancellation penalty scores since they pay per session. When enabled, cancellation restrictions apply to external clients.
              </p>
            </div>
            <Switch
              id="enforce_external_client_cancellations"
              checked={Boolean(form.enforce_external_client_cancellations)}
              onCheckedChange={checked => handleChange('enforce_external_client_cancellations', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Academic Calendar</CardTitle>
          <CardDescription>Current academic year and semester configuration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="academic_year">Academic Year</Label>
              <Input
                id="academic_year"
                value={form.academic_year}
                onChange={e => handleChange('academic_year', e.target.value)}
                placeholder="2025-2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_semester">Current Semester</Label>
              <Select
                value={form.current_semester}
                onValueChange={v => handleChange('current_semester', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1st Semester">1st Semester</SelectItem>
                  <SelectItem value="2nd Semester">2nd Semester</SelectItem>
                  <SelectItem value="Summer">Summer</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
