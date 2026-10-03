"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
    Settings as SettingsIcon,
    User,
    Lock,
    Bell,
    Shield,
    LogOut,
    Mail,
    UserCheck,
    Pencil,
    Check,
    X,
    Loader2,
    CalendarDays
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PasswordResetRequestDialog } from '@/components/shared/PasswordResetRequestDialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
    const { user, signOut, refreshUser } = useAuth()
    const { toast } = useToast()

    // Inline editing state for name
    const [isEditingName, setIsEditingName] = useState(false)
    const [editName, setEditName] = useState(user?.fullName || '')
    const [isEditingNotificationEmail, setIsEditingNotificationEmail] = useState(false)
    const [editNotificationEmail, setEditNotificationEmail] = useState(user?.notificationEmail || '')
    const [saving, setSaving] = useState(false)

    const handleEditName = () => {
        setEditName(user?.fullName || '')
        setIsEditingName(true)
    }

    const handleEditNotificationEmail = () => {
        setEditNotificationEmail(user?.notificationEmail || '')
        setIsEditingNotificationEmail(true)
    }

    const handleCancelEdit = () => {
        setIsEditingName(false)
        setEditName(user?.fullName || '')
        setIsEditingNotificationEmail(false)
        setEditNotificationEmail(user?.notificationEmail || '')
    }

    const handleSaveName = async () => {
        const trimmed = editName.trim()
        if (trimmed.length < 2) {
            toast({ title: 'Invalid name', description: 'Name must be at least 2 characters.', variant: 'destructive' })
            return
        }
        setSaving(true)
        try {
            const res = await fetch('/api/auth/update-profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: trimmed }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to update name')
            }
            toast({ title: 'Name updated', description: 'Your display name has been saved.' })
            setIsEditingName(false)
            await refreshUser()
            window.location.reload()
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    const handleSaveNotificationEmail = async () => {
        const trimmed = editNotificationEmail.trim()
        setSaving(true)
        try {
            const res = await fetch('/api/auth/update-profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationEmail: trimmed || null }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to update email')
            }
            toast({ title: 'Email updated', description: 'Your notification email has been saved.' })
            setIsEditingNotificationEmail(false)
            await refreshUser()
            window.location.reload()
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    const [strictInstructorRequirement, setStrictInstructorRequirement] = useState<boolean | null>(null)
    const [togglingStrict, setTogglingStrict] = useState(false)

    // Fetch schedule policies on mount
    useEffect(() => {
        fetch('/api/settings/schedule-policy')
            .then(r => r.json())
            .then(data => {
                if (data.strict_instructor_requirement !== undefined) {
                    setStrictInstructorRequirement(data.strict_instructor_requirement)
                }
            })
            .catch(err => console.error('Failed to fetch schedule policies', err))
    }, [])

    const handleToggleStrictInstructor = async () => {
        if (strictInstructorRequirement === null) return
        setTogglingStrict(true)
        try {
            const newValue = !strictInstructorRequirement
            const res = await fetch('/api/settings/schedule-policy', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strict_instructor_requirement: newValue })
            })
            if (!res.ok) throw new Error('Failed to update setting')
            setStrictInstructorRequirement(newValue)
            toast({ title: 'Setting updated', description: `Strict Instructor Requirement is now ${newValue ? 'Enabled' : 'Disabled'}.` })
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setTogglingStrict(false)
        }
    }

    const settingsSections = [
        {
            title: "Profile Information",
            icon: User,
            items: [
                { id: 'fullName', label: "Full Name", value: user?.fullName || "Not set", icon: UserCheck, editable: true },
                { id: 'primaryEmail', label: "Primary Email", value: user?.email || "Not set", icon: Mail, editable: false },
                { id: 'notificationEmail', label: "Notification Email", value: user?.notificationEmail || "Not provided", icon: Mail, editable: true },
            ]
        },
        {
            title: "Schedule Policies",
            icon: Bell,
            customRender: true,
            items: []
        },
        {
            title: "Security",
            icon: Shield,
            items: [
                { id: 'changePassword', label: "Change Password", value: "Last changed 3 months ago", icon: Lock, editable: false },
            ]
        },
        {
            title: "Notifications",
            icon: Bell,
            items: [
                { id: 'emailNotifications', label: "Email Notifications", value: "Enabled", icon: Bell, editable: false },
            ]
        }
    ]
    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#060A11] transition-colors duration-300">
            <div className="p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto space-y-10 pb-20">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-900 dark:text-white">
                            Account <span className="text-accent-brand">Settings</span>
                        </h1>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-[0.2em]">
                            Manage your academic head profile and system preferences
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {settingsSections.map((section, idx) => (
                        <section key={idx} className="bg-white dark:bg-[#0B0F17] rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                            {/* Section Title Bar */}
                            <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                                <h2 className="text-[11px] font-black text-slate-900 dark:text-slate-300 flex items-center gap-4 uppercase tracking-[0.3em]">
                                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-white/5">
                                        <section.icon className="w-4 h-4 text-accent-brand" />
                                    </div>
                                    {section.title}
                                </h2>
                            </div>

                            {/* Section Items */}
                            {section.customRender && section.title === 'Schedule Policies' ? (
                                <div className="divide-y divide-slate-50 dark:divide-white/5">
                                    <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors group">
                                        <div className="flex items-center gap-6 flex-1 min-w-0">
                                            <div className="w-12 h-12 shrink-0 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-accent-brand transition-colors border border-transparent group-hover:border-slate-200 dark:group-hover:border-white/10">
                                                <CalendarDays className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">STRICT INSTRUCTOR REQUIREMENT</p>
                                                <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">
                                                    {strictInstructorRequirement === null ? 'Loading...' : strictInstructorRequirement ? 'Enabled' : 'Disabled'}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1 lowercase first-letter:uppercase font-medium">Blocks Program Heads from uploading schedules without an assigned instructor.</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-end shrink-0">
                                            <button
                                                onClick={handleToggleStrictInstructor}
                                                disabled={togglingStrict || strictInstructorRequirement === null}
                                                role="switch"
                                                aria-checked={!!strictInstructorRequirement}
                                                className={cn(
                                                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0072bc] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
                                                    strictInstructorRequirement ? "bg-[#0072bc]" : "bg-slate-200 dark:bg-slate-700"
                                                )}
                                            >
                                                <span className="sr-only">Toggle Strict Instructor</span>
                                                <span
                                                    className={cn(
                                                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                                        strictInstructorRequirement ? "translate-x-5" : "translate-x-0"
                                                    )}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50 dark:divide-white/5">
                                    {section.items.map((item, i) => (
                                        <div key={i} className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors group">
                                            <div className="flex items-center gap-6 flex-1 min-w-0">
                                                <div className="w-12 h-12 shrink-0 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-accent-brand transition-colors border border-transparent group-hover:border-slate-200 dark:group-hover:border-white/10">
                                                    <item.icon className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">{item.label}</p>
                                                    
                                                    {item.editable && ((item.id === 'fullName' && isEditingName) || (item.id === 'notificationEmail' && isEditingNotificationEmail)) ? (
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <input
                                                                type={item.id === 'notificationEmail' ? 'email' : 'text'}
                                                                value={item.id === 'fullName' ? editName : editNotificationEmail}
                                                                onChange={(e) => item.id === 'fullName' ? setEditName(e.target.value) : setEditNotificationEmail(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') item.id === 'fullName' ? handleSaveName() : handleSaveNotificationEmail()
                                                                    if (e.key === 'Escape') handleCancelEdit()
                                                                }}
                                                                placeholder={item.id === 'notificationEmail' ? 'e.g. personal@example.com' : ''}
                                                                autoFocus
                                                                className="text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-brand/20 w-full max-w-sm shadow-inner transition-all"
                                                            />
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={item.id === 'fullName' ? handleSaveName : handleSaveNotificationEmail}
                                                                    disabled={saving}
                                                                    className="rounded-xl h-10 w-10 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-90"
                                                                >
                                                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={handleCancelEdit}
                                                                    disabled={saving}
                                                                    className="rounded-xl h-10 w-10 bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-90"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">{item.value}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex justify-end shrink-0">
                                                {item.editable && !((item.id === 'fullName' && isEditingName) || (item.id === 'notificationEmail' && isEditingNotificationEmail)) ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={item.id === 'fullName' ? handleEditName : handleEditNotificationEmail}
                                                        className="rounded-xl w-10 h-10 bg-slate-100 dark:bg-white/5 hover:bg-accent-brand hover:text-white dark:hover:text-slate-900 transition-all active:scale-95 shadow-sm"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                ) : item.label === 'Change Password' ? (
                                                    <PasswordResetRequestDialog 
                                                        trigger={
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm"
                                                                className="rounded-xl border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest h-10 px-6 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900 transition-all"
                                                            >
                                                                Request Reset
                                                            </Button>
                                                        } 
                                                    />
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}

                    {/* Sign Out Card */}
                    <section className="bg-rose-50 dark:bg-rose-950/10 rounded-[2.5rem] border border-rose-100 dark:border-rose-900/20 p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8 group">
                        <div className="flex items-center gap-8 text-center md:text-left flex-col md:flex-row">
                            <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-[2rem] flex items-center justify-center text-rose-500 shadow-xl shadow-rose-500/10 border border-rose-100 dark:border-white/5 group-hover:scale-105 transition-transform duration-500">
                                <LogOut className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-rose-900 dark:text-rose-400 uppercase tracking-tighter">Session Management</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-rose-700/60 dark:text-rose-500/60 mt-1">
                                    Logged in as {user?.fullName || "Authorized Academic Head"}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            onClick={() => signOut()}
                            className="w-full md:w-auto px-10 h-14 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-500/20 transition-all active:scale-95"
                        >
                            Sign Out of Dashboard
                        </Button>
                    </section>
                </div>

                {/* Footer Branding */}
                <div className="text-center pt-12">
                    <p className="text-[9px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.5em] flex items-center justify-center gap-4">
                        <span className="h-px w-8 bg-slate-200 dark:bg-slate-800" />
                        RESERVEIT v1.0.0 · STI COLLEGE GLOBAL THEME
                        <span className="h-px w-8 bg-slate-200 dark:bg-slate-800" />
                    </p>
                </div>
            </div>
        </div>
    )
}