/**
 * Cron Route — Academic Head Reminders
 * Runs daily at midnight UTC (8:00 AM PHT).
 * Sends 3-day advance notices for upcoming maintenance and facility blocks.
 *
 * Trigger via Vercel Cron or manually:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" /api/cron/academic-head-reminders
 *
 * @module app/api/cron/academic-head-reminders
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  maintenanceReminderEmail,
  facilityBlockReminderEmail,
} from '@/backend/notifications/emailTemplates'
import { getAcademicHeadEmail } from '@/backend/notifications/recipientResolver'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const academicHeadEmail = await getAcademicHeadEmail()
  if (!academicHeadEmail) {
    console.warn('[cron] No active Academic Head — skipping all reminder emails')
    return NextResponse.json({ success: false, reason: 'No active Academic Head found' })
  }

  // Target date = today + 3 days in Philippine Time (UTC+8)
  const now = new Date()
  const phtNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  phtNow.setUTCDate(phtNow.getUTCDate() + 3)
  const targetDateStr = phtNow.toISOString().split('T')[0] // YYYY-MM-DD

  const supabase = createAdminClient()
  const results = {
    maintenanceSent: 0,
    facilityBlocksSent: 0,
    errors: [] as string[],
  }

  // ── Trigger 3: Maintenance records scheduled in 3 days ───────────────────
  const { data: maintenanceItems, error: maintErr } = await supabase
    .from('maintenance_records')
    .select('id, type, target_name, schedule_date, technician, notes, status')
    .eq('schedule_date', targetDateStr)
    .neq('status', 'completed')
    .eq('is_active', true)

  if (maintErr) {
    results.errors.push(`maintenance_records: ${maintErr.message}`)
  } else {
    for (const record of maintenanceItems ?? []) {
      const { subject, htmlBody } = maintenanceReminderEmail({
        targetName: record.target_name,
        maintenanceType: record.type,
        scheduledDate: new Date(record.schedule_date).toLocaleDateString('en-PH', {
          timeZone: 'Asia/Manila',
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        }),
        technician: record.technician,
        notes: record.notes ?? undefined,
      })
      await sendBrevoEmail({ to: academicHeadEmail, subject, htmlBody })
      results.maintenanceSent++
    }
  }

  // ── Trigger 4: Facility blocks starting in 3 days ────────────────────────
  const startOfDay = `${targetDateStr}T00:00:00+08:00`
  const endOfDay   = `${targetDateStr}T23:59:59+08:00`

  const { data: facilityBlocks, error: blocksErr } = await supabase
    .from('facility_blocks')
    .select(`
      id, block_type, start_time, end_time, reason,
      facilities ( name )
    `)
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)

  if (blocksErr) {
    results.errors.push(`facility_blocks: ${blocksErr.message}`)
  } else {
    for (const block of facilityBlocks ?? []) {
      const facilityRaw = block.facilities as { name: string } | Array<{ name: string }> | null
      const facilityName = (Array.isArray(facilityRaw) ? facilityRaw[0]?.name : facilityRaw?.name) ?? 'Unknown Facility'

      const { subject, htmlBody } = facilityBlockReminderEmail({
        facilityName,
        blockType: block.block_type,
        reason: block.reason ?? undefined,
        startTime: new Date(block.start_time).toLocaleString('en-PH', {
          timeZone: 'Asia/Manila',
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
        endTime: new Date(block.end_time).toLocaleString('en-PH', {
          timeZone: 'Asia/Manila',
          hour: '2-digit', minute: '2-digit',
        }),
      })
      await sendBrevoEmail({ to: academicHeadEmail, subject, htmlBody })
      results.facilityBlocksSent++
    }
  }

  console.log('[cron] academic-head-reminders result:', results)
  return NextResponse.json({
    success: true,
    date: targetDateStr,
    ...results,
  })
}
