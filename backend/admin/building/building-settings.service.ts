/**
 * Building Settings Service
 *
 * Profile updates and user preferences (notifications, locale, appearance).
 */

import { createAdminClient } from '@/lib/supabase/server'
import {
  type NotificationPreferences,
  type LocalePreferences,
  type AppearancePreferences,
  type ProfileUpdateData,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_LOCALE_PREFS,
  DEFAULT_APPEARANCE_PREFS,
} from './building.types'

type PreferenceCategory = 'notifications' | 'locale' | 'appearance'

const DEFAULTS: Record<PreferenceCategory, Record<string, any>> = {
  notifications: DEFAULT_NOTIFICATION_PREFS,
  locale: DEFAULT_LOCALE_PREFS,
  appearance: DEFAULT_APPEARANCE_PREFS,
}

export const BuildingSettingsService = {
  // ─── Profile ───

  async updateProfile(userId: string, data: ProfileUpdateData) {
    const supabase = createAdminClient()

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (data.fullName !== undefined) updates.full_name = data.fullName
    if (data.phone !== undefined) updates.phone = data.phone
    if (data.notificationEmail !== undefined) updates.notification_email = data.notificationEmail || null
    if (data.gender !== undefined) updates.gender = data.gender || null
    if (data.language !== undefined) updates.language = data.language || null

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)

    if (error) throw new Error(`Failed to update profile: ${error.message}`)
    return { success: true }
  },

  // ─── Preferences ───

  async getPreferences(userId: string, category?: PreferenceCategory) {
    const supabase = createAdminClient()

    if (category) {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preferences')
        .eq('user_id', userId)
        .eq('category', category)
        .maybeSingle()

      if (error) throw new Error(`Failed to fetch preferences: ${error.message}`)
      return data?.preferences ?? DEFAULTS[category]
    }

    // Fetch all categories
    const { data, error } = await supabase
      .from('user_preferences')
      .select('category, preferences')
      .eq('user_id', userId)

    if (error) throw new Error(`Failed to fetch preferences: ${error.message}`)

    const result: Record<string, any> = {
      notifications: DEFAULT_NOTIFICATION_PREFS,
      locale: DEFAULT_LOCALE_PREFS,
      appearance: DEFAULT_APPEARANCE_PREFS,
    }

    for (const row of data || []) {
      result[row.category] = row.preferences
    }

    return result as {
      notifications: NotificationPreferences
      locale: LocalePreferences
      appearance: AppearancePreferences
    }
  },

  async updatePreferences(
    userId: string,
    category: PreferenceCategory,
    preferences: Record<string, any>,
  ) {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: userId,
          category,
          preferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,category' },
      )

    if (error) throw new Error(`Failed to update preferences: ${error.message}`)
    return { success: true }
  },

  // ─── Storage usage ───

  /**
   * Walks every app-managed Storage bucket and sums object sizes.
   * Buckets are created lazily on first upload (see avatar/photo routes), so a
   * bucket that doesn't exist yet just contributes 0 bytes rather than erroring.
   */
  async getStorageUsage() {
    const supabase = createAdminClient()
    const DEFAULT_MANAGED_BUCKETS = [
      'avatars',
      'facility-photos',
      'schedule-report-attachments',
      'payment-qr-codes',
      'payment-screenshots',
      'payment-pictures',
      'payment-proofs',
      'payment-receipts',
    ]
    const MAX_DEPTH = 5 // safety cap; real paths here are 1 level deep (userId/... , facilityId/...)

    async function walk(bucket: string, prefix = '', depth = 0): Promise<{ bytes: number; count: number }> {
      if (depth > MAX_DEPTH) return { bytes: 0, count: 0 }

      const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 })
      if (error || !data) return { bytes: 0, count: 0 }

      let bytes = 0
      let count = 0
      for (const entry of data) {
        if (entry.id) {
          // A real object — folders come back with id: null
          bytes += entry.metadata?.size ?? 0
          count += 1
        } else {
          const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name
          const child = await walk(bucket, childPrefix, depth + 1)
          bytes += child.bytes
          count += child.count
        }
      }
      return { bytes, count }
    }

    const { data: existingBuckets } = await supabase.storage.listBuckets()
    const existingNames = new Set((existingBuckets || []).map(b => b.name))
    const allBucketNames = Array.from(new Set([...DEFAULT_MANAGED_BUCKETS, ...(existingBuckets || []).map(b => b.name)]))

    const buckets = await Promise.all(
      allBucketNames.map(async (bucket) => {
        if (!existingNames.has(bucket)) return { bucket, bytes: 0, fileCount: 0, exists: false }
        const { bytes, count } = await walk(bucket)
        return { bucket, bytes, fileCount: count, exists: true }
      })
    )

    return {
      buckets,
      totalBytes: buckets.reduce((sum, b) => sum + b.bytes, 0),
      totalFiles: buckets.reduce((sum, b) => sum + b.fileCount, 0),
    }
  },
}
