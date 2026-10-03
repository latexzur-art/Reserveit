'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import type {
  NotificationPreferences,
  LocalePreferences,
  AppearancePreferences,
} from '@/backend/admin/building/building.types'
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_LOCALE_PREFS,
  DEFAULT_APPEARANCE_PREFS,
} from '@/backend/admin/building/building.types'

export function useBuildingSettings() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()

  // Profile
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '', notificationEmail: '', gender: '', language: '' })
  const [profileLoading, setProfileLoading] = useState(false)

  // Preferences
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS)
  const [localePrefs, setLocalePrefs] = useState<LocalePreferences>(DEFAULT_LOCALE_PREFS)
  const [appearancePrefs, setAppearancePrefs] = useState<AppearancePreferences>(DEFAULT_APPEARANCE_PREFS)
  const [prefsLoading, setPrefsLoading] = useState(true)

  // Init profile from auth user
  useEffect(() => {
    if (user) {
      setProfileForm({
        fullName: user.fullName || '',
        phone: user.phone || '',
        notificationEmail: user.notificationEmail || '',
        gender: user.gender || 'Female',
        language: user.language || 'English',
      })
    }
  }, [user])

  // Fetch preferences on mount
  const fetchPreferences = useCallback(async () => {
    try {
      setPrefsLoading(true)
      const res = await fetch('/api/admin/building/settings/preferences')
      if (res.ok) {
        const data = await res.json()
        if (data.notifications) setNotificationPrefs(data.notifications)
        if (data.locale) setLocalePrefs(data.locale)
        if (data.appearance) setAppearancePrefs(data.appearance)
      }
    } catch {
      // Use defaults on error
    } finally {
      setPrefsLoading(false)
    }
  }, [])

  useEffect(() => { fetchPreferences() }, [fetchPreferences])

  // Apply compact mode on load
  useEffect(() => {
    if (!prefsLoading) {
      document.documentElement.classList.toggle('compact', appearancePrefs.compactMode)
    }
  }, [prefsLoading, appearancePrefs.compactMode])

  // ─── Profile ───
  const saveProfile = useCallback(async (data: { fullName: string; phone: string; notificationEmail?: string; gender?: string; language?: string }) => {
    setProfileLoading(true)
    try {
      const res = await fetch('/api/admin/building/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to save profile')
      toast({ title: 'Profile updated successfully' })
      await refreshUser()
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    } finally {
      setProfileLoading(false)
    }
  }, [refreshUser, toast])

  // ─── Preferences helpers ───
  const updatePrefs = useCallback(async (category: string, preferences: Record<string, any>) => {
    try {
      const res = await fetch('/api/admin/building/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, preferences }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save preferences')
      }
      toast({ title: 'Preferences saved' })
      return true
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      return false
    }
  }, [toast])

  const updateNotificationPrefs = useCallback(async (prefs: NotificationPreferences) => {
    setNotificationPrefs(prefs)
    return updatePrefs('notifications', prefs)
  }, [updatePrefs])

  const updateLocalePrefs = useCallback(async (prefs: LocalePreferences) => {
    setLocalePrefs(prefs)
    return updatePrefs('locale', prefs)
  }, [updatePrefs])

  const updateAppearancePrefs = useCallback(async (prefs: AppearancePreferences) => {
    setAppearancePrefs(prefs)
    document.documentElement.classList.toggle('compact', prefs.compactMode)
    return updatePrefs('appearance', prefs)
  }, [updatePrefs])

  return {
    // Profile
    profileForm, setProfileForm, saveProfile, profileLoading,
    // Notifications
    notificationPrefs, updateNotificationPrefs,
    // Locale
    localePrefs, updateLocalePrefs,
    // Appearance
    appearancePrefs, updateAppearancePrefs,
    // General
    prefsLoading,
  }
}
