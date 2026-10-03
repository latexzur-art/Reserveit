/**
 * Emergency reschedule — shared types, settings loader, format helpers.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface EmergencyProposalInput {
  bookingId: string
  adminUserId: string
  newDate: string
  newStartTime: string
  newEndTime: string
  newFacilityId?: string
  customMessage?: string
}

export interface EmergencyRespondInput {
  bookingId: string
  userId: string
  action: 'accept' | 'decline_convert_to_credit'
}

export interface EmergencyHoldInput {
  bookingId: string
  adminUserId: string
}

export interface EmergencyRefundCancelInput {
  bookingId: string
  adminUserId: string
  refundReason?: string
  creditAmountCentavos?: number
}

export interface EmergencyResult {
  success: boolean
  message: string
  overrideId?: string
}

export interface EmergencySettings {
  helpdeskPhone: string
  rescheduleTemplate: string
  declineTemplate: string
  cancelTemplate: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

export async function loadEmergencySettings(supabase: SupabaseClient): Promise<EmergencySettings> {
  const keys = [
    'emergency_helpdesk_phone',
    'emergency_reschedule_message_template',
    'emergency_decline_response_template',
    'emergency_cancel_message_template',
  ]
  const { data } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', keys)

  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    // If it's a string, use it directly. If it's an object/number, stringify it.
    map[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value)
  }

  return {
    helpdeskPhone: map['emergency_helpdesk_phone'] ?? '(043) 123-4567',
    rescheduleTemplate: map['emergency_reschedule_message_template'] ?? '',
    declineTemplate: map['emergency_decline_response_template'] ?? '',
    cancelTemplate: map['emergency_cancel_message_template'] ?? '',
  }
}

// ─── 1. proposeEmergencyReschedule ───────────────────────────────────────────

export async function getEmergencySettings(supabase: SupabaseClient): Promise<EmergencySettings> {
  return loadEmergencySettings(supabase)
}
