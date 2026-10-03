import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/routes'

/**
 * Resolves the best email address for a user.
 * For external clients: prefers external_clients.contact_email (their registered correspondence email).
 * For all other users: notification_email only — never falls back to the Entra/Azure sign-in
 * email, since that mailbox is not one users actually check.
 */
export async function resolveUserEmail(
  supabase: SupabaseClient,
  userId: string
): Promise<{ emailTo: string | null; name: string | null }> {
  const { data } = await supabase
    .from('users')
    .select('email, notification_email, full_name, external_clients(contact_email)')
    .eq('id', userId)
    .single()

  if (!data) return { emailTo: null, name: null }

  const extContact = (data as any).external_clients?.[0]?.contact_email ?? null
  const emailTo = extContact ?? (data as any).notification_email ?? null

  if (!emailTo) {
    console.warn(`[recipientResolver] User ${userId} has no notification_email set — email skipped`)
  }

  return { emailTo, name: (data as any).full_name ?? null }
}

export async function getBuildingAdminEmails(): Promise<string[]> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        users!user_roles_user_id_fkey (
          id,
          email,
          notification_email
        ),
        roles!inner (
          name
        )
      `)
      .eq('roles.name', 'building_admin')
      .eq('is_active', true)

    if (error) {
      console.error('[recipientResolver] DB error fetching building admin emails:', error.message)
      return []
    }

    if (!data || data.length === 0) {
      console.warn('[recipientResolver] No active Building Admin found')
      return []
    }

    const emails: string[] = []
    for (const row of data as any[]) {
      const email = row.users?.notification_email
      if (email) {
        emails.push(email)
      } else {
        console.warn(`[recipientResolver] Building Admin ${row.users?.id ?? '(unknown)'} has no notification_email set — skipped`)
      }
    }
    return emails
  } catch (err) {
    console.error('[recipientResolver] Unexpected error:', err)
    return []
  }
}

/**
 * Returns the role-appropriate bookings and payment page URLs for a user.
 * Notifications and emails will link to the correct page per role.
 */
export async function resolveUserPageUrls(
  supabase: SupabaseClient,
  userId: string
): Promise<{ bookingsUrl: string; paymentUrl: string }> {
  const defaults = { bookingsUrl: '/client/bookings', paymentUrl: '/client/payment' }
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(5)

    const roleNames: string[] = (data ?? []).map((r: any) => r.roles?.name).filter(Boolean)

    if (roleNames.includes('faculty'))
      return { bookingsUrl: '/faculty/reservations', paymentUrl: '/faculty/payment' }
    if (roleNames.includes('program_head'))
      return { bookingsUrl: '/program/reservations', paymentUrl: '/program/payment' }
    if (roleNames.includes('academic_head'))
      return { bookingsUrl: ROUTES.academic.myReservations, paymentUrl: ROUTES.academic.payment }

    return defaults
  } catch {
    return defaults
  }
}

export async function getAcademicHeadEmail(): Promise<string | null> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('user_roles')
      // user_roles has two FKs to users (user_id and assigned_by) — must hint which one
      .select(`
        users!user_roles_user_id_fkey (
          id,
          email,
          notification_email
        ),
        roles!inner (
          name
        )
      `)
      .eq('roles.name', 'academic_head')
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('[recipientResolver] DB error fetching academic head email:', error.message)
      return null
    }

    if (!data) {
      console.warn('[recipientResolver] No active Academic Head found')
      return null
    }

    const userRow = (data as any)?.users
    const recipient = userRow?.notification_email ?? null

    if (!recipient) {
      console.warn(`[recipientResolver] Academic Head ${userRow?.id ?? '(unknown)'} has no notification_email set — email skipped`)
      return null
    }

    return recipient
  } catch (err) {
    console.error('[recipientResolver] Unexpected error:', err)
    return null
  }
}
