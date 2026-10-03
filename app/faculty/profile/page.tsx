"use client"

import { useEffect, useState } from 'react'
import { User, Mail, Phone, Calendar, Edit, Settings, Shield, BookOpen, Loader2, Camera, Building2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PasswordResetRequestDialog } from '@/components/shared/PasswordResetRequestDialog'
import { CancellationRateResetCard } from '@/components/shared/CancellationRateResetCard'
import { ApprovalLikelihoodCard } from '@/components/shared/ApprovalLikelihoodCard'
import { RoleTopBar } from '@/components/shared/RoleTopBar'
import { ROUTES } from '@/lib/routes'
import { UserProfile } from '@/components/layout/shared/UserProfile'
import { useFacultyLayout } from '../_components/FacultyLayoutContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { SkeletonList } from "@/components/ui/SkeletonList";


import { useRouter } from 'next/navigation'
import { useFacultyNotifications } from '@/hooks/faculty/useFacultyNotifications'
import { bookingStatusLabel } from '@/lib/enum-labels'

interface RecentBooking {
  id: string
  booking_reference: string
  booking_date: string
  current_status: string
  purpose: string
}

export default function FacultyProfile() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const { toggleMobileMenu } = useFacultyLayout()
  const router = useRouter()
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useFacultyNotifications()
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    notificationEmail: '',
  })
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)

  useEffect(() => {
    if (!user) return
    setFormData({
      fullName: user.fullName ?? '',
      phone: user.phone ?? '',
      notificationEmail: user.notificationEmail ?? '',
    })
  }, [user])

  useEffect(() => {
    let cancelled = false
    async function loadActivity() {
      setLoadingActivity(true)
      try {
        const res = await fetch('/api/bookings?pageSize=5')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setRecentBookings((data.bookings ?? []).slice(0, 5))
      } finally {
        if (!cancelled) setLoadingActivity(false)
      }
    }
    loadActivity()
    return () => { cancelled = true }
  }, [])

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
      const contentType = res.headers.get('content-type')
      const data = contentType?.includes('application/json') ? await res.json() : {}
      if (!res.ok) {
        toast({ title: 'Update failed', description: data?.error ?? 'Unable to update profile.', variant: 'destructive' })
        return
      }
      await refreshUser()
      setIsEditing(false)
      toast({ title: 'Profile updated' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      fullName: user?.fullName ?? '',
      phone: user?.phone ?? '',
      notificationEmail: user?.notificationEmail ?? '',
    })
    setIsEditing(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <RoleTopBar
        title="Profile Settings"
        portalTitle="Faculty Portal"
        breadcrumbs={[{ label: 'Dashboard' }]}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkNotificationRead={markRead}
        onMarkAllNotificationsRead={markAllRead}
        onClearAllNotifications={clearAll}
        onOpenMessageCenter={() => router.push(ROUTES.faculty.notifications)}
        onMobileMenuToggle={() => toggleMobileMenu()}
        formRoute={ROUTES.faculty.form}
        calendarRoute={ROUTES.faculty.calendar}
        profileMenu={<UserProfile settingsRoute={ROUTES.faculty.profile} />}
      />

      <main className="container mx-auto px-4 md:px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Account <span className="text-accent-brand">Settings</span></h1>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Manage your profile, preferences, and activity</p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-1 rounded-2xl h-12 shadow-sm">
              <TabsTrigger value="profile" className="rounded-xl font-bold uppercase tracking-wider text-xs data-[state=active]:bg-teal-600 data-[state=active]:text-white transition-all">Profile</TabsTrigger>
              <TabsTrigger value="account" className="rounded-xl font-bold uppercase tracking-wider text-xs data-[state=active]:bg-teal-600 data-[state=active]:text-white transition-all">Account</TabsTrigger>
              <TabsTrigger value="activity" className="rounded-xl font-bold uppercase tracking-wider text-xs data-[state=active]:bg-teal-600 data-[state=active]:text-white transition-all">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
                <CardHeader className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Personal Information</CardTitle>
                      <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
                        Update your identity and contact points
                      </CardDescription>
                    </div>
                    {!isEditing ? (
                      <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="rounded-xl font-bold uppercase text-xs tracking-wider h-9 px-5 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <Edit className="w-3 h-3 mr-2" />
                        Edit Profile
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button onClick={handleSave} size="sm" disabled={saving} className="rounded-xl font-bold uppercase text-xs tracking-wider h-9 bg-teal-600 hover:bg-teal-700 text-white">
                          {saving ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
                          Save Changes
                        </Button>
                        <Button onClick={handleCancel} variant="ghost" size="sm" disabled={saving} className="rounded-xl font-bold uppercase text-xs tracking-wider h-9 px-5 text-slate-500">
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6 md:p-8 space-y-8">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative group">
                      <div className="w-24 h-24 bg-teal-50 dark:bg-teal-500/10 rounded-3xl flex items-center justify-center border-2 border-teal-100 dark:border-teal-500/20 shadow-inner">
                        <User className="w-12 h-12 text-accent-brand" />
                      </div>
                      <div title="Coming soon" className="absolute -bottom-1 -right-1 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 shadow-lg cursor-not-allowed opacity-50">
                        <Camera className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    </div>
                    <div className="text-center sm:text-left space-y-1">
                      <h3 className="font-black text-xl text-slate-900 dark:text-white uppercase tracking-tighter leading-none">{user?.fullName || 'Faculty Member'}</h3>
                      <p className="text-xs font-bold text-accent-brand uppercase tracking-wider">Certified Faculty / Teacher</p>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-1">STI College Faculty Member</p>
                    </div>
                  </div>

                  <Separator className="bg-slate-100 dark:bg-white/5" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</Label>
                      {isEditing ? (
                        <Input
                          id="fullName"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 focus:ring-teal-500 h-11"
                        />
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-white/5">
                          <User className="w-4 h-4 text-slate-400" />
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formData.fullName || '—'}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</Label>
                      <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-white/5 opacity-70">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 italic">{user?.email ?? '—'}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-slate-400">Mobile Number</Label>
                      {isEditing ? (
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 focus:ring-teal-500 h-11"
                        />
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-white/5">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formData.phone || 'Not provided'}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="notificationEmail" className="text-xs font-bold uppercase tracking-wider text-slate-400">Notification Email</Label>
                      {isEditing ? (
                        <Input
                          id="notificationEmail"
                          type="email"
                          value={formData.notificationEmail}
                          onChange={(e) => setFormData({ ...formData, notificationEmail: e.target.value })}
                          placeholder="e.g. personal@example.com"
                          className="rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 focus:ring-teal-500 h-11"
                        />
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-white/5">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formData.notificationEmail || 'Not provided'}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="department" className="text-xs font-bold uppercase tracking-wider text-slate-400">Department</Label>
                      <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-white/5 opacity-70">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                          {user?.department?.name ?? 'Not assigned'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
                <CardHeader className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5">
                  <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                    <Settings className="w-5 h-5 text-accent-brand" />
                    Security Settings
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
                    Manage your credentials and access safety
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 md:p-8 space-y-4">
                  <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-white/5 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm">
                        <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Account Password</p>
                        <p className="text-xs font-bold text-slate-500 uppercase">Change or reset your security key</p>
                      </div>
                    </div>
                    <PasswordResetRequestDialog trigger={
                      <Button variant="outline" size="sm" className="rounded-xl font-bold uppercase tracking-wider text-xs h-9 border-slate-200 dark:border-white/10 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 transition-colors">
                        Request Password Reset
                      </Button>
                    } />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-white/5 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm">
                        <Mail className="w-5 h-5 text-accent-brand" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Verification Status</p>
                        <p className="text-xs font-bold text-slate-500 uppercase">{user?.email ?? '—'}</p>
                      </div>
                    </div>
                    <Badge className={`rounded-lg px-3 py-1 font-bold text-xs uppercase tracking-wider ${user?.emailVerified ? 'bg-teal-500/10 text-accent-brand border-teal-500/20' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                      {user?.emailVerified ? 'VERIFIED' : 'UNVERIFIED'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <ApprovalLikelihoodCard />
              <CancellationRateResetCard />
            </TabsContent>

            <TabsContent value="activity" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
                <CardHeader className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5">
                  <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-accent-brand" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
                    Your history of reservation interactions
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 md:p-8">
                  {loadingActivity ? (
                    <SkeletonList />
                  ) : recentBookings.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-200 dark:border-white/5">
                      <Calendar className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">No activity logged</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentBookings.map(b => (
                        <div key={b.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-950/50 rounded-2xl border border-transparent hover:border-slate-100 dark:hover:border-white/5 transition-all duration-300">
                          <div className="w-10 h-10 bg-teal-50 dark:bg-teal-500/10 rounded-xl flex items-center justify-center border border-teal-100 dark:border-teal-500/20 shrink-0">
                            <Calendar className="w-5 h-5 text-accent-brand" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight truncate">{b.booking_reference}</p>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">{b.purpose}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">{b.booking_date}</p>
                            <span className="text-xs font-bold text-accent-brand uppercase tracking-wider">{bookingStatusLabel(b.current_status)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}