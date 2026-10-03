"use client"

import { useState, useEffect } from 'react'
import { User, Mail, Phone, Calendar, Edit, Settings, Shield, BookOpen, Building2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PasswordResetRequestDialog } from '@/components/shared/PasswordResetRequestDialog'
import { CancellationRateResetCard } from '@/components/shared/CancellationRateResetCard'
import { ApprovalLikelihoodCard } from '@/components/shared/ApprovalLikelihoodCard'
import { ConnectedTopBar } from '../_components/ConnectedTopBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { bookingStatusLabel } from '@/lib/enum-labels'
import { SkeletonList } from '@/components/ui/SkeletonList'

const STATUS_BADGE: Record<string, string> = {
  auto_approved: 'bg-green-50 text-green-700 ring-1 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400',
  approved:      'bg-green-50 text-green-700 ring-1 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400',
  pending:       'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400',
  flagged:       'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  completed:     'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400',
  cancelled:     'bg-slate-100 text-slate-500 dark:bg-slate-900/20 dark:text-slate-400',
  rejected:      'bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400',
}

export default function ProgramHeadProfile() {
  const { user } = useAuth()

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    notificationEmail: user?.notificationEmail || '',
  })

  // Sync with auth user on load
  useEffect(() => {
    setFormData({
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      notificationEmail: user?.notificationEmail || '',
    })
  }, [user])

  interface RecentBooking {
    id: string
    facility_name?: string
    facilityName?: string
    booking_date?: string
    bookingDate?: string
    start_time?: string
    startTime?: string
    end_time?: string
    endTime?: string
    status?: string
    current_status?: string
  }

  // Recent bookings for Activity tab
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [loadingActivity, setLoadingActivity] = useState(true)

  useEffect(() => {
    fetch('/api/bookings?pageSize=5')
      .then(r => r.json())
      .then(data => setRecentBookings(data.bookings ?? []))
      .catch(() => {})
      .finally(() => setLoadingActivity(false))
  }, [])

  const handleSave = async () => {
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      toast.error('Name must be at least 2 characters.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fullName: formData.fullName.trim(), 
          phone: formData.phone.trim() || null,
          notificationEmail: formData.notificationEmail.trim() || null
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      toast.success('Profile updated successfully.')
      setIsEditing(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'An error occurred')
    }
    setSaving(false)
  }

  const handleCancel = () => {
    setFormData({ 
      fullName: user?.fullName || '', 
      phone: user?.phone || '',
      notificationEmail: user?.notificationEmail || ''
    })
    setIsEditing(false)
  }

  return (
    <div className="space-y-6 p-4 sm:p-8 lg:p-12">
      <div className="sticky top-0 z-40 -mx-4 sm:-mx-8 lg:-mx-12 -mt-4 sm:-mt-8 lg:-mt-12 mb-8">
        <ConnectedTopBar title="Profile Settings" breadcrumbs={[{ label: 'Dashboard', href: '/program/dashboard' }]} />
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase text-foreground">
              Account <span className="text-accent-brand">Intelligence</span>
            </h1>
            <p className="dashboard-header-subtitle text-pico font-bold text-muted-foreground mt-1 uppercase tracking-[0.2em]">
              Manage Your Personal Security & Profile Data
            </p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            {/* ── Profile Tab ── */}
            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Personal Information</CardTitle>
                      <CardDescription>Your profile details — contact your admin to change department or role.</CardDescription>
                    </div>
                    {!isEditing ? (
                      <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button onClick={handleSave} size="sm" disabled={saving}>
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button onClick={handleCancel} variant="outline" size="sm" disabled={saving}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center shrink-0">
                      <User className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{user?.fullName || 'Program Head'}</h3>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {user?.roles.map(r => (
                          <Badge key={r.id} variant="secondary" className="text-xs">
                            {r.displayName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Full Name — editable */}
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      {isEditing ? (
                        <Input
                          id="fullName"
                          value={formData.fullName}
                          onChange={(e) => setFormData(p => ({ ...p, fullName: e.target.value }))}
                        />
                      ) : (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm text-muted-foreground">
                          <User className="w-4 h-4 shrink-0" />
                          {formData.fullName || '—'}
                        </div>
                      )}
                    </div>

                    {/* Email — read-only */}
                    <div className="space-y-2">
                      <Label>Primary Email</Label>
                      <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm text-muted-foreground opacity-70">
                        <Mail className="w-4 h-4 shrink-0" />
                        {user?.email || '—'}
                      </div>
                    </div>

                    {/* Notification Email — editable */}
                    <div className="space-y-2">
                      <Label htmlFor="notificationEmail">Notification Email</Label>
                      {isEditing ? (
                        <Input
                          id="notificationEmail"
                          type="email"
                          value={formData.notificationEmail}
                          onChange={(e) => setFormData(p => ({ ...p, notificationEmail: e.target.value }))}
                          placeholder="e.g. personal@example.com"
                        />
                      ) : (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm text-muted-foreground">
                          <Mail className="w-4 h-4 shrink-0" />
                          {formData.notificationEmail || 'Not provided'}
                        </div>
                      )}
                    </div>

                    {/* Phone — editable */}
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      {isEditing ? (
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                          placeholder="e.g. +63 912 345 6789"
                        />
                      ) : (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm text-muted-foreground">
                          <Phone className="w-4 h-4 shrink-0" />
                          {formData.phone || 'Not provided'}
                        </div>
                      )}
                    </div>

                    {/* Department — read-only */}
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm text-muted-foreground">
                        <Building2 className="w-4 h-4 shrink-0" />
                        {user?.department?.name ?? 'No department assigned'}
                      </div>
                    </div>

                    {/* Employee ID — read-only */}
                    {user?.employeeId && (
                      <div className="space-y-2">
                        <Label>Employee ID</Label>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm text-muted-foreground">
                          <Shield className="w-4 h-4 shrink-0" />
                          {user.employeeId}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Account Tab ── */}
            <TabsContent value="account" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Account Settings
                  </CardTitle>
                  <CardDescription>Your account details and security status.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Account Status</p>
                        <p className="text-sm text-muted-foreground capitalize">{user?.accountStatus ?? 'Active'}</p>
                      </div>
                    </div>
                    <Badge variant={user?.accountStatus === 'active' ? 'default' : 'secondary'} className="capitalize">
                      {user?.accountStatus ?? 'Active'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    <Badge variant={user?.emailVerified ? 'default' : 'destructive'}>
                      {user?.emailVerified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Last Login</p>
                        <p className="text-sm text-muted-foreground">
                          {user?.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleString()
                            : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-muted-foreground">Managed by your authentication provider</p>
                      </div>
                    </div>
                    <PasswordResetRequestDialog trigger={<Button variant="outline" size="sm">Request Password Reset</Button>} />
                  </div>
                </CardContent>
              </Card>

              <ApprovalLikelihoodCard />
              <CancellationRateResetCard />
            </TabsContent>

            {/* ── Activity Tab ── */}
            <TabsContent value="activity" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Your 5 most recent reservations.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingActivity ? (
                    <SkeletonList count={3} />
                  ) : recentBookings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No reservations yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentBookings.map((b: RecentBooking) => (
                        <div key={b.id} className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                          <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {b.facility_name ?? b.facilityName ?? 'Facility'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {(b.booking_date ?? b.bookingDate)
                                ? new Date((b.booking_date ?? b.bookingDate) as string).toLocaleDateString()
                                : '—'}
                              {(b.start_time ?? b.startTime) && ` • ${String(b.start_time ?? b.startTime).slice(0, 5)}–${String(b.end_time ?? b.endTime).slice(0, 5)}`}
                            </p>
                          </div>
                          <span className={cn(
                            'text-xs px-2 py-1 rounded-full shrink-0',
                            STATUS_BADGE[b.current_status ?? b.status ?? ''] ?? 'bg-slate-100 text-slate-600'
                          )}>
                            {bookingStatusLabel(b.current_status ?? b.status ?? 'unknown')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
    </div>
  )
}
