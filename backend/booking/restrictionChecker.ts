/**
 * Restriction Checker
 * Checks if a user is restricted or on probation before running the booking pipeline.
 * @module backend/booking/restrictionChecker
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RestrictionCheckResult {
  restricted: boolean
  probation: boolean
  reason?: string
  restricted_at?: string
  consecutive_cancellations?: number
  has_appeal?: boolean
  appeal_reason?: string | null
}

export async function checkUserRestriction(
  supabase: SupabaseClient,
  userId: string
): Promise<RestrictionCheckResult> {
  const { data: user, error } = await supabase
    .from('users')
    .select(
      'account_status, consecutive_cancellations, restricted_at, restricted_reason, appeal_reason, appeal_submitted_at'
    )
    .eq('id', userId)
    .single()

  if (error) {
    throw new Error(`Failed to check user restriction status: ${error.message}`)
  }

  if (!user) {
    throw new Error(`User ${userId} not found`)
  }

  if (user.account_status === 'restricted') {
    return {
      restricted: true,
      probation: false,
      reason:
        user.restricted_reason ||
        `Account restricted after ${user.consecutive_cancellations} consecutive cancellations. Please contact the building administrator.`,
      restricted_at: user.restricted_at,
      consecutive_cancellations: user.consecutive_cancellations,
      has_appeal: !!user.appeal_reason,
      appeal_reason: user.appeal_reason,
    }
  }

  if (user.account_status === 'probation') {
    return {
      restricted: false,
      probation: true,
      reason:
        'Your account is on probation. All bookings require manual administrator approval.',
      consecutive_cancellations: user.consecutive_cancellations,
    }
  }

  return {
    restricted: false,
    probation: false,
    consecutive_cancellations: user.consecutive_cancellations,
  }
}
