'use client'

import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  User, Shield, Bell, Monitor,
  HelpCircle, Save, Mail,
  ShieldCheck, Loader2, Camera, Plus, ShieldOff, HardDrive
} from "lucide-react";
import { PasswordResetRequestDialog } from '@/components/shared/PasswordResetRequestDialog'
import { DangerZoneTab } from '@/components/admin/settings/DangerZoneTab'
import { StorageUsageCard } from '@/components/admin/settings/StorageUsageCard'
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useBuildingSettings } from "@/hooks/admin/building";
import { toast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { user } = useAuth();
  const isBuildingAdmin = user?.roles?.some((r) => r.name === 'building_admin') ?? false;
  const { theme, setTheme } = useTheme();
  const { profileForm, setProfileForm, saveProfile, notificationPrefs: hookNotificationPrefs, updateNotificationPrefs } = useBuildingSettings();

  const [isSaving, setIsSaving] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<typeof hookNotificationPrefs>(hookNotificationPrefs);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Show the persisted avatar once the auth profile loads
  useEffect(() => {
    if (user?.avatarUrl) setProfileImage(user.avatarUrl);
  }, [user?.avatarUrl]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-sync the local draft once the hook finishes fetching saved preferences
  useEffect(() => {
    setNotificationPrefs(hookNotificationPrefs);
  }, [hookNotificationPrefs]);

  const handleInputChange = (key: 'fullName' | 'phone' | 'notificationEmail' | 'gender' | 'language', value: string) => {
    setProfileForm(prev => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Instant local preview while the upload runs
    const reader = new FileReader();
    reader.onloadend = () => setProfileImage(reader.result as string);
    reader.readAsDataURL(file);

    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/building/settings/avatar', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setProfileImage(data.avatarUrl);
      toast({ title: "Success", description: "Profile photo updated" });
    } catch (err: any) {
      setProfileImage(user?.avatarUrl ?? null);
      toast({ title: "Error", description: err.message || "Failed to upload photo", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await saveProfile({
        fullName: profileForm.fullName,
        phone: profileForm.phone,
        notificationEmail: profileForm.notificationEmail,
        gender: profileForm.gender,
        language: profileForm.language,
      });
      toast({ title: "Success", description: "Profile updated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save profile", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      await updateNotificationPrefs(notificationPrefs);
      toast({ title: "Success", description: "Notification preferences updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save preferences", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-10">
      {/* HEADER */}
      <div className="px-1 flex justify-between items-end">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">System <span className="text-accent-brand">Settings</span></h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Manage your professional identity and dashboard preferences
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-muted/30 p-1 rounded-2xl h-12 flex-wrap md:flex-nowrap gap-1 mb-8 shadow-sm border border-border/20">
          <TabsTrigger value="profile" className="text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm px-5">
            <User className="w-3.5 h-3.5 mr-2" /> Profile
          </TabsTrigger>
          <TabsTrigger value="appearance" className="text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm px-5">
            <Monitor className="w-3.5 h-3.5 mr-2" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="security" className="text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm px-5">
            <Shield className="w-3.5 h-3.5 mr-2" /> Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm px-5">
            <Bell className="w-3.5 h-3.5 mr-2" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="help" className="text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm px-5">
            <HelpCircle className="w-3.5 h-3.5 mr-2" /> Support
          </TabsTrigger>
          {isBuildingAdmin && (
            <TabsTrigger value="storage" className="text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm px-5">
              <HardDrive className="w-3.5 h-3.5 mr-2" /> Storage
            </TabsTrigger>
          )}
          {isBuildingAdmin && (
            <TabsTrigger value="danger" className="text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm px-5 text-red-600 dark:text-red-400 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400">
              <ShieldOff className="w-3.5 h-3.5 mr-2" /> Danger Zone
            </TabsTrigger>
          )}
        </TabsList>

        {/* --- PROFILE SECTION (Matches Uploaded Image Style) --- */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="p-10 rounded-[2.5rem] border-border bg-card shadow-none relative overflow-hidden">
            {/* Top Decorative Banner Area */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-r from-blue-500/10 via-yellow-400/5 to-transparent border-b border-border/20" />

            <div className="relative pt-6">
              {/* Profile Header */}
              <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between mb-12">
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 border-4 border-background shadow-2xl ring-1 ring-border/20">
                      <AvatarImage src={profileImage || ""} className="object-cover" />
                      <AvatarFallback className="bg-muted text-muted-foreground/30">
                        <User className="w-12 h-12" strokeWidth={1.5} />
                      </AvatarFallback>
                    </Avatar>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Camera className="text-white h-5 w-5" />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      className="hidden" 
                      accept="image/*"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-foreground uppercase tracking-tight">{profileForm.fullName}</h2>
                    <p className="text-xs font-bold text-muted-foreground opacity-70">{user?.email}</p>
                  </div>
                </div>
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="rounded-xl bg-sti-blue hover:bg-sti-blue-dark text-white text-[10px] font-black uppercase px-8 h-11 transition-transform active:scale-95 shadow-lg shadow-sti-blue/20"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <EditableItem id="fName" label="Full Name" value={profileForm.fullName} onChange={(v) => handleInputChange('fullName', v)} disabled={isSaving} />
                <EditableItem id="phone" label="Phone" value={profileForm.phone} onChange={(v) => handleInputChange('phone', v)} disabled={isSaving} />

                <div className="space-y-3">
                  <Label htmlFor="profile-gender" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Gender</Label>
                  <Select value={profileForm.gender || "Female"} onValueChange={(v) => handleInputChange('gender', v)} disabled={isSaving}>
                    <SelectTrigger id="profile-gender" className="h-14 rounded-2xl bg-muted/30 border-none text-xs font-bold uppercase px-6">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Female" className="text-xs font-bold uppercase">Female</SelectItem>
                      <SelectItem value="Male" className="text-xs font-bold uppercase">Male</SelectItem>
                      <SelectItem value="Other" className="text-xs font-bold uppercase">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>


                <div className="space-y-3">
                  <Label htmlFor="profile-language" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Language</Label>
                  <Select value={profileForm.language || "English"} onValueChange={(v) => handleInputChange('language', v)} disabled={isSaving}>
                    <SelectTrigger id="profile-language" className="h-14 rounded-2xl bg-muted/30 border-none text-xs font-bold uppercase px-6">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="English" className="text-xs font-bold uppercase">English</SelectItem>
                      <SelectItem value="Filipino" className="text-xs font-bold uppercase">Filipino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>

              {/* Email Section */}
              <div className="mt-16 pt-10 border-t border-border/30">
                <h3 className="text-[10px] font-black uppercase text-foreground tracking-widest mb-6">My Email Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="flex items-center gap-5 p-6 rounded-[2rem] bg-muted/20 border border-border/10">
                    <div className="p-3.5 bg-sti-blue/10 rounded-2xl">
                      <Mail className="w-5 h-5 text-sti-blue" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-black uppercase text-foreground truncate">{user?.email || 'N/A'}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">Primary Login Email (Read-Only)</p>
                    </div>
                  </div>
                  <div>
                    <EditableItem 
                      id="notificationEmail" 
                      label="Notification Email" 
                      value={profileForm.notificationEmail || ''} 
                      onChange={(v) => handleInputChange('notificationEmail', v)} 
                      disabled={isSaving} 
                      type="email"
                      placeholder="e.g. personal@example.com"
                    />
                    <p className="text-[9px] font-bold text-muted-foreground uppercase mt-3 ml-2">
                      Where alerts will be sent if provided.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* --- APPEARANCE SECTION --- */}
        <TabsContent value="appearance">
          <Card className="p-10 rounded-[2.5rem] border-border bg-card shadow-none">
            <h3 className="text-sm font-black uppercase tracking-tight text-foreground mb-8">System Aesthetics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-sti-blue" />
                  <Label htmlFor="appearance-theme" className="text-[11px] font-black uppercase tracking-widest text-foreground">Theme Settings</Label>
                </div>
                <Select value={theme} onValueChange={(v) => setTheme(v)}>
                  <SelectTrigger id="appearance-theme" className="h-14 rounded-2xl bg-muted/30 border-none px-6">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="light" className="text-xs font-bold uppercase">Light Mode</SelectItem>
                    <SelectItem value="dark" className="text-xs font-bold uppercase">Dark Mode</SelectItem>
                    <SelectItem value="system" className="text-xs font-bold uppercase">System Default</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* --- SECURITY SECTION --- */}
        <TabsContent value="security">
          <Card className="p-10 rounded-[2.5rem] border-border bg-card shadow-none space-y-10">
            <div className="flex items-center justify-between p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center gap-4">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                <div>
                  <h4 className="text-[10px] font-black uppercase text-foreground">Account Protection</h4>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Multi-factor authentication is active</p>
                </div>
              </div>
            </div>

            <div className="space-y-6 max-w-md">
              <h3 className="text-sm font-black uppercase tracking-tight text-foreground">Credential Update</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Your password is managed by Microsoft Entra. Submit a request and the IT Admin will reset it for you.
              </p>
              <PasswordResetRequestDialog
                trigger={
                  <Button className="rounded-xl bg-foreground text-background text-[10px] font-black uppercase px-8 h-12 shadow-lg">
                    Request Password Reset
                  </Button>
                }
              />
            </div>
          </Card>
        </TabsContent>

        {/* --- NOTIFICATIONS SECTION --- */}
        <TabsContent value="notifications">
          <Card className="p-10 rounded-[2.5rem] border-border bg-card shadow-none space-y-8">
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-foreground mb-2">Notification Preferences</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Control how you receive alerts and updates</p>
            </div>

            <div className="space-y-6">
              <NotificationToggle
                label="Email Notifications"
                description="Receive updates via email"
                checked={notificationPrefs.emailNotifications}
                onChange={(v) => setNotificationPrefs(prev => ({ ...prev, emailNotifications: v }))}
              />
              <NotificationToggle
                label="Booking Alerts"
                description="Get notified about booking confirmations and changes"
                checked={notificationPrefs.bookingAlerts}
                onChange={(v) => setNotificationPrefs(prev => ({ ...prev, bookingAlerts: v }))}
              />
              <NotificationToggle
                label="Push Notifications"
                description="Browser push notifications for real-time alerts"
                checked={notificationPrefs.pushNotifications}
                onChange={(v) => setNotificationPrefs(prev => ({ ...prev, pushNotifications: v }))}
              />
              <NotificationToggle
                label="System Alerts"
                description="Receive notifications about system maintenance and updates"
                checked={notificationPrefs.systemAlerts}
                onChange={(v) => setNotificationPrefs(prev => ({ ...prev, systemAlerts: v }))}
              />
            </div>

            <div className="pt-6 border-t border-border/20">
              <Button
                onClick={handleSaveNotifications}
                className="rounded-xl bg-sti-blue hover:bg-sti-blue-dark text-white text-[10px] font-black uppercase px-8 h-11 shadow-lg"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Preferences
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* --- SUPPORT --- */}
        <TabsContent value="help">
          <Card className="p-10 rounded-[2.5rem] border-border bg-muted/10 shadow-none">
             <div className="space-y-8">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-foreground mb-1">Support Center</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">Need help with the ReserveIT Admin Framework?</p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button variant="outline" className="h-16 rounded-2xl px-8 text-[10px] font-black uppercase border-border/60 hover:bg-card">Documentation</Button>
                <Button variant="outline" className="h-16 rounded-2xl px-8 text-[10px] font-black uppercase border-border/60 hover:bg-card">Submit Ticket</Button>
              </div>
              <div className="pt-10 border-t border-border/20">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                  ReserveIT — STI College Lucena
                </p>
                <p className="text-[9px] font-bold text-muted-foreground/40 mt-1 uppercase">Admin Platform v1.0.0 Stable</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* --- STORAGE USAGE (building_admin only) --- */}
        {isBuildingAdmin && (
          <TabsContent value="storage">
            <StorageUsageCard />
          </TabsContent>
        )}

        {/* --- DANGER ZONE (building_admin only) --- */}
        {isBuildingAdmin && (
          <TabsContent value="danger">
            <DangerZoneTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* --- HELPER COMPONENTS --- */
function EditableItem({ id, label, value, onChange, disabled, type = "text", placeholder = "Enter details..." }: { id: string, label: string, value: string, onChange: (v: string) => void, disabled?: boolean, type?: string, placeholder?: string }) {
  return (
    <div className="space-y-3">
      <Label htmlFor={id} className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-14 rounded-2xl bg-muted/30 border-none text-xs font-bold px-6 focus-visible:ring-2 focus-visible:ring-primary/20"
      />
    </div>
  );
}

function NotificationToggle({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-6 rounded-2xl bg-muted/20 border border-border/30 hover:border-border/50 transition-colors">
      <div className="flex-1">
        <p className="text-[10px] font-black uppercase text-foreground tracking-widest">{label}</p>
        <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 rounded-full transition-colors ${checked ? 'bg-sti-blue' : 'bg-muted-foreground/30'}`}
      >
        <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${checked ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}