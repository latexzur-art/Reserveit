/**
 * Admin Data-Wipe Service
 *
 * Thin wrapper over the destructive `admin_wipe_*` SQL functions. These are
 * TESTING / RESET tools — callers must enforce role guards and the
 * environment gate (see lib/env/data-wipe.ts) before invoking.
 */

import { createAdminClient } from '@/lib/supabase/server'

export type WipeTier = 'bookings' | 'schedules' | 'curriculum' | 'all'

/** Roles whose holders are never deleted by a user wipe (staff/admin). */
export const DEFAULT_PRESERVE_ROLES = [
  'building_admin',
  'academic_head',
  'it_admin',
  'program_head',
  'faculty',
] as const

type CountMap = Record<string, number>

export const DataWipeService = {
  /** Row counts per major table, for the dry-run preview. */
  async dataCounts(): Promise<CountMap> {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('admin_count_wipe_data')
    if (error) throw new Error(error.message)
    return (data ?? {}) as CountMap
  },

  /** Execute a tier wipe; returns per-table deleted counts. */
  async wipeData(tier: WipeTier) {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('admin_wipe_data', { p_tier: tier })
    if (error) throw new Error(error.message)
    return data as { success: boolean; tier: string; deleted: CountMap }
  },

  /** How many users a wipe would delete right now. */
  async userCount(
    actorId: string,
    preserveRoles: readonly string[] = DEFAULT_PRESERVE_ROLES,
  ): Promise<number> {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('admin_count_wipe_users', {
      p_actor_id: actorId,
      p_preserve_roles: preserveRoles as string[],
    })
    if (error) throw new Error(error.message)
    return (data ?? 0) as number
  },

  /** Permanently delete all non-preserved users. */
  async wipeUsers(
    actorId: string,
    preserveRoles: readonly string[] = DEFAULT_PRESERVE_ROLES,
  ) {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('admin_wipe_users', {
      p_actor_id: actorId,
      p_preserve_roles: preserveRoles as string[],
    })
    if (error) throw new Error(error.message)
    return data as { success: boolean; deleted_count: number }
  },
}
