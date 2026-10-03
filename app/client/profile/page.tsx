"use client"

import { useState } from 'react'
import { User, Mail, Phone, Calendar, Edit, Settings, Shield, Activity, Save, X, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ChangePasswordDialog } from '@/components/shared/ChangePasswordDialog'
import { CancellationRateResetCard } from '@/components/shared/CancellationRateResetCard'
import { ConnectedClientTopBar } from '../_components/ConnectedClientTopBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { userRoleLabel } from '@/lib/enum-labels'
import { ROUTES } from '@/lib/routes'
import { useToast } from '@/hooks/use-toast'

export default function ClientProfile() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    notificationEmail: user?.notificationEmail || '',
    phone: user?.phone || '',
    organization: '',
    bio: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          phone: formData.phone || null,
          notificationEmail: formData.notificationEmail || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Update failed', description: data?.error ?? 'Unable to update profile.', variant: 'destructive' })
        return
      }
      await refreshUser()
      setIsEditing(false)
      toast({ title: 'Profile updated successfully' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      fullName: user?.fullName || '',
      email: user?.email || '',
      notificationEmail: user?.notificationEmail || '',
      phone: user?.phone || '',
      organization: '',
      bio: '',
    })
    setIsEditing(false)
  }

  // Deduplicate user role labels
  const roleBadges = (() => {
    const labels: string[] = []
    if (Array.isArray(user?.roles) && user.roles.length > 0) {
      user.roles.forEach((r: any) => {
        const label = typeof r === 'object' ? (r.displayName || r.name) : String(r)
        if (label) labels.push(userRoleLabel(label))
      })
    } else {
      labels.push(user?.userType === 'internal' ? 'STAFF' : 'EXTERNAL CLIENT')
    }
    if (formData.organization && !labels.includes(formData.organization)) {
      labels.push(formData.organization)
    }
    return Array.from(new Set(labels))
  })();

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <ConnectedClientTopBar title="Profile Settings" breadcrumbs={[{ label: 'Dashboard', href: ROUTES.client.dashboard }]} />

      <main className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8 pb-24">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Profile <span className="text-yellow-600 dark:text-yellow-400">Settings</span>
            </h1>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              Manage your account details and security preferences
            </p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList role="tablist" className="grid w-full grid-cols-2 p-1 bg-muted/40 border border-border/60 rounded-xl h-12">
            <TabsTrigger
              value="profile"
              role="tab"
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-ring"
            >
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="account"
              role="tab"
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-ring"
            >
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
              <CardHeader className="p-6 border-b border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground">Personal Information</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Update your personal details and notification contacts
                    </CardDescription>
                  </div>
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="h-9 px-4 rounded-xl border-border/80 text-xs font-semibold hover:bg-muted/40">
                      <Edit className="w-3.5 h-3.5 mr-1.5" />Edit Profile
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button onClick={handleSave} disabled={saving} size="sm" className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-xs">
                        {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}Save
                      </Button>
                      <Button onClick={handleCancel} variant="outline" size="sm" className="h-9 px-4 rounded-xl border-border/80 text-xs font-semibold hover:bg-muted/40">
                        <X className="w-3.5 h-3.5 mr-1.5" />Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-5 p-5 rounded-xl bg-muted/30 border border-border/60">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shrink-0">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center sm:text-left space-y-1.5">
                    <h3 className="text-base font-bold text-foreground">
                      {user?.fullName || 'External User'}
                    </h3>
                    
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                      {roleBadges.map((badgeLabel, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-primary/10 text-primary border-primary/20 px-2.5 py-0.5 rounded-lg text-xs font-semibold uppercase tracking-wider"
                        >
                          {badgeLabel}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-xs font-semibold text-foreground">Full Name</Label>
                    {isEditing ? (
                      <Input id="fullName" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} className="rounded-xl h-10 border-border/80 focus:ring-primary text-xs" />
                    ) : (
                      <div className="h-10 flex items-center px-3.5 bg-muted/20 border border-border/60 rounded-xl text-xs font-medium text-foreground">
                        {formData.fullName || '—'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-semibold text-foreground">Primary Email <span className="text-muted-foreground font-normal">(Read-Only)</span></Label>
                    <div className="h-10 flex items-center px-3.5 bg-muted/40 border border-border/60 rounded-xl text-xs font-medium text-muted-foreground">
                      {user?.email || '—'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notificationEmail" className="text-xs font-semibold text-foreground">Notification Email</Label>
                    {isEditing ? (
                      <Input id="notificationEmail" type="email" value={formData.notificationEmail} onChange={e => setFormData({ ...formData, notificationEmail: e.target.value })} placeholder="e.g. personal@example.com" className="rounded-xl h-10 border-border/80 focus:ring-primary text-xs" />
                    ) : (
                      <div className="h-10 flex items-center px-3.5 bg-muted/20 border border-border/60 rounded-xl text-xs font-medium text-foreground">
                        {formData.notificationEmail || 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs font-semibold text-foreground">Phone Number</Label>
                    {isEditing ? (
                      <Input id="phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="rounded-xl h-10 border-border/80 focus:ring-primary text-xs" />
                    ) : (
                      <div className="h-10 flex items-center px-3.5 bg-muted/20 border border-border/60 rounded-xl text-xs font-medium text-foreground">
                        {formData.phone || 'Not provided'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organization" className="text-xs font-semibold text-foreground">Organization / Institution</Label>
                    {isEditing ? (
                      <Input id="organization" value={formData.organization} onChange={e => setFormData({ ...formData, organization: e.target.value })} className="rounded-xl h-10 border-border/80 focus:ring-primary text-xs" />
                    ) : (
                      <div className="h-10 flex items-center px-3.5 bg-muted/20 border border-border/60 rounded-xl text-xs font-medium text-foreground">
                        {formData.organization || 'Not provided'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-xs font-semibold text-foreground">About You</Label>
                  {isEditing ? (
                    <Textarea id="bio" value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} rows={3} className="rounded-xl border-border/80 focus:ring-primary text-xs" />
                  ) : (
                    <div className="p-3.5 min-h-[80px] bg-muted/20 border border-border/60 rounded-xl text-xs font-medium text-foreground">
                      {formData.bio || 'No bio added yet.'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card className="bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden">
              <CardHeader className="p-6 border-b border-border/60">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" />
                  System Preferences &amp; Security
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Manage your account security and notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/20 border border-border/60 rounded-xl gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-card border border-border/60 text-primary">
                      <Shield size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-foreground">Account Password</p>
                      <p className="text-xs text-muted-foreground">Update your login password securely</p>
                    </div>
                  </div>
                  <ChangePasswordDialog trigger={
                    <Button variant="outline" size="sm" className="w-full sm:w-auto rounded-xl h-9 px-4 border-border/80 text-xs font-semibold hover:bg-muted/40">
                      Change Password
                    </Button>
                  } />
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/20 border border-border/60 rounded-xl gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-card border border-border/60 text-primary">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-foreground">Email Notifications</p>
                      <p className="text-xs text-muted-foreground">Booking approvals, updates, and payment reminders</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    <Activity size={12} className="text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Enabled</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-muted/20 border border-border/60 rounded-xl gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-card border border-border/60 text-primary">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-foreground">Timezone</p>
                      <p className="text-xs text-muted-foreground">Used for facility booking schedules</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-border/80 px-3 py-1 rounded-lg text-xs font-semibold">
                    PH / UTC+8
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <CancellationRateResetCard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}