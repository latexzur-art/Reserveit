/**
 * Cron Route — Booking Reminders
 * Runs every 30 minutes. Sends in-app notifications at 4 time windows before
 * a booking's start time: 24h, 12h, 3h, and 1h.
 *
 * Deduplication: checks the notifications table for an existing 'booking_reminder'
 * entry with the same booking_id + window before sending — no extra DB columns needed.
 *
 * Trigger via Vercel Cron or manually:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" /api/cron/booking-reminders
 *
 * @module app/api/cron/booking-reminders
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { bookingReminder24hEmail, bookingReminder1hEmail } from '@/backend/notifications/emailTemplates'

export const dynamic = 'force-dynamic'

const REMINDER_WINDOWS = [
  {
    key: '24h',
    targetHours: 24,
    title: (ref: string) => `Booking Tomorrow — ${ref}`,
    message: (ref: string, facility: string, startTime: string, duration: string) =>
      `Your booking ${ref} for ${facility} is tomorrow at ${startTime} (${duration}). Make sure you're prepared!`,
  },
  {
    key: '12h',
    targetHours: 12,
    title: (ref: string) => `Booking in 12 Hours — ${ref}`,
    message: (ref: string, facility: string, startTime: string, _duration: string) =>
      `Your booking ${ref} for ${facility} starts in about 12 hours at ${startTime}.`,
  },
  {
    key: '3h',
    targetHours: 3,
    title: (ref: string) => `Booking in 3 Hours — ${ref}`,
    message: (ref: string, facility: string, startTime: string, _duration: string) =>
      `Your booking ${ref} for ${facility} starts in 3 hours at ${startTime}. Please be ready.`,
  },
  {
    key: '1h',
    targetHours: 1,
    title: (ref: string) => `Booking Starting Soon — ${ref}`,
    message: (ref: string, facility: string, startTime: string, _duration: string) =>
      `Your booking ${ref} for ${facility} starts in 1 hour at ${startTime}!`,
  },
] as const

/** Half the cron interval (30 min) used as the detection band on each side of the target. */
const BAND_HOURS = 0.5

function fmt12h(t: string): string {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  return `${h % 12 || 12}:${mStr.padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function durationLabel(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return ''
  return mins >= 60
    ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`
    : `${mins}m`
}

/** Returns lead time in hours from now until the booking starts (Manila +08:00). */
function computeLeadHours(bookingDate: string, startTime: string): number {
  const startIso = `${bookingDate}T${startTime.length === 5 ? `${startTime}:00` : startTime}+08:00`
  const startMs = Date.parse(startIso)
  return (startMs - Date.now()) / 3_600_000
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Target date range: bookings starting in the next 25 hours (covers all windows)
  const nowMs = Date.now()
  const windowEndMs = nowMs + 25 * 3_600_000

  // Convert to Manila-local YYYY-MM-DD for the date filter
  const toManilaDate = (ms: number) => {
    const d = new Date(ms + 8 * 3_600_000) // shift to +08:00
    return d.toISOString().split('T')[0]
  }
  const dateFrom = toManilaDate(nowMs)
  const dateTo = toManilaDate(windowEndMs)

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      id,
      user_id,
      booking_reference,
      booking_date,
      start_time,
      end_time,
      booking_facilities(facility_id, facilities(name)),
      users!bookings_user_id_fkey(full_name, email, notification_email, user_roles!user_roles_user_id_fkey(roles(name)))
    `)
    .in('current_status', ['approved', 'auto_approved'])
    .gte('booking_date', dateFrom)
    .lte('booking_date', dateTo)

  if (error) {
    console.error('[cron/booking-reminders] Query error:', error.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  let remindersSent = 0
  const windowCounts: Record<string, number> = { '24h': 0, '12h': 0, '3h': 0, '1h': 0 }

  for (const booking of bookings ?? []) {
    const leadHours = computeLeadHours(booking.booking_date, booking.start_time)

    // Skip bookings already started or more than 25h away
    if (leadHours < 0 || leadHours > 25) continue

    const facilityRaw = (booking as any).booking_facilities?.[0]?.facilities
    const facilityName = (Array.isArray(facilityRaw) ? facilityRaw[0]?.name : facilityRaw?.name) ?? 'your facility'
    const bookingRef = booking.booking_reference ?? booking.id
    const startLabel = fmt12h(booking.start_time)
    const durLabel = durationLabel(booking.start_time, booking.end_time)

    for (const window of REMINDER_WINDOWS) {
      const inWindow =
        leadHours >= window.targetHours - BAND_HOURS &&
        leadHours < window.targetHours + BAND_HOURS

      if (!inWindow) continue

      // Deduplication: check if this reminder was already sent
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('source_type', 'booking_reminder')
        .eq('source_id', booking.id)
        .eq('user_id', booking.user_id)
        .filter('metadata->>window', 'eq', window.key)
        .limit(1)
        .maybeSingle()

      if (existing) continue

      await sendNotification(supabase, {
        user_id: booking.user_id,
        title: window.title(bookingRef),
        message: window.message(bookingRef, facilityName, startLabel, durLabel),
        type: 'info',
        source_type: 'booking_reminder',
        source_id: booking.id,
        priority: window.targetHours <= 3 ? 'high' : 'normal',
        metadata: {
          window: window.key,
          booking_reference: bookingRef,
          facility_name: facilityName,
          start_time: startLabel,
          duration: durLabel,
          lead_hours: Math.round(leadHours * 10) / 10,
        },
      })

      // Send email for 24h and 1h windows only
      if (window.key === '24h' || window.key === '1h') {
        const userRaw = (booking as any).users
        const userRow = Array.isArray(userRaw) ? userRaw[0] : userRaw
        const recipient = userRow?.notification_email ?? null
        const userName = (userRow?.full_name as string) ?? 'User'
        const rawRole = (userRow?.user_roles as any)?.[0]?.roles?.name ?? ''
        const userRole = rawRole.split('_').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')

        if (!recipient) {
          console.warn(`[booking-reminders] User ${booking.user_id} has no notification_email set — reminder email skipped`)
        }
        if (recipient) {
          if (window.key === '24h') {
            const endLabel = fmt12h(booking.end_time)
            void sendBrevoEmail({
              to: recipient,
              ...bookingReminder24hEmail({
                userName,
                bookingRef,
                facilityName,
                bookingDate: booking.booking_date,
                startTime: startLabel,
                endTime: endLabel,
                duration: durLabel,
                userRole,
              }),
            })
          } else {
            void sendBrevoEmail({
              to: recipient,
              ...bookingReminder1hEmail({
                userName,
                bookingRef,
                facilityName,
                startTime: startLabel,
                duration: durLabel,
                userRole,
              }),
            })
          }
        }
      }

      remindersSent++
      windowCounts[window.key]++
    }
  }

  console.log(`[cron/booking-reminders] Sent ${remindersSent} reminder(s)`, windowCounts)
  return NextResponse.json({
    success: true,
    reminders_sent: remindersSent,
    windows: windowCounts,
  })
}
