/**
 * POST /api/schedules/uploads/[id]/publish
 * Academic-head instant-publish path.
 *
 * Unlike the review-queue flow (parse → submit → review → finalize), this endpoint
 * lets an academic head commit their own upload directly to the live calendar.
 *
 * Policy ("schedule takes priority"):
 *   • Every staging entry with validation_status in ('valid','warning') is promoted.
 *   • Overlapping bookings → auto-cancelled (existing behaviour from review/publish).
 *   • Overlapping class_schedules entries from OTHER departments → soft-superseded
 *     (is_active=false, superseded_by, superseded_at, supersede_reason). The prior
 *     uploader receives an in-app + email notification.
 *   • Same-department overlaps → the new row is skipped (don't supersede yourself).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { scheduleSupersededEmail } from '@/backend/notifications/emailTemplates'
import { parseUuidParam } from '@/lib/api/validate-uuid'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface SupersededEntry {
  oldScheduleId: string
  oldUploadId: string | null
  oldUploaderId: string | null
  newScheduleId: string
  courseCode: string
  section: string
  facilityName: string
  dayTime: string
}

interface OverlappingSchedule {
  id: string
  department_id: string | null
  schedule_upload_id: string | null
  course_code: string | null
  section: string | null
  day_of_week: number
  start_time: string
  end_time: string
  effective_start_date: string | null
  effective_end_date: string | null
  facility_id: string | null
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const { id: rawId } = await params
  const idParse = parseUuidParam(rawId, 'upload id')
  if (!idParse.ok) return idParse.response
  const uploadId = idParse.value
  const supabase = createAdminClient()

  // 1. Load upload + ensure in a publishable state.
  const { data: upload, error: uploadErr } = await supabase
    .from('schedule_uploads')
    .select('id, upload_status, academic_term_id, department_id, batch_effective_date, batch_effective_end_date, uploaded_by')
    .eq('id', uploadId)
    .single()

  if (uploadErr || !upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  // Non-terminal states only — matches the review route. 'rejected'/'approved' are
  // terminal and must not be re-published (would duplicate live class_schedules).
  const publishableStatuses = ['pending_submission', 'submitted', 'under_review', 'partially_approved', 'draft', 'validation_failed', 'revision_requested']
  if (!publishableStatuses.includes(upload.upload_status)) {
    return NextResponse.json(
      { error: `Cannot publish upload in status: ${upload.upload_status}` },
      { status: 409 },
    )
  }

  // 2. Pull term for fallback effective dates.
  const { data: term } = await supabase
    .from('academic_terms')
    .select('start_date, end_date')
    .eq('id', upload.academic_term_id)
    .single()

  // 3. Auto-approve every entry that passed validation. errors are skipped.
  await supabase
    .from('schedule_entries_staging')
    .update({
      academic_head_review_status: 'academic_head_approved',
      academic_head_reviewed_by: user.id,
      academic_head_reviewed_at: new Date().toISOString(),
    })
    .eq('schedule_upload_id', uploadId)
    .in('academic_head_review_status', ['pending_review', 'academic_head_flagged'])
    .in('validation_status', ['valid', 'warning'])

  // 4. Fetch the now-approved entries with a resolved facility.
  const { data: approvedEntries } = await supabase
    .from('schedule_entries_staging')
    .select('*')
    .eq('schedule_upload_id', uploadId)
    .eq('academic_head_review_status', 'academic_head_approved')
    .eq('is_published', false)
    .not('facility_id', 'is', null)

  if (!approvedEntries || approvedEntries.length === 0) {
    return NextResponse.json(
      { error: 'No publishable entries — every row has a validation error, is already published, or has an unresolved facility.' },
      { status: 422 },
    )
  }

  // 5. Track outcomes.
  let publishedCount = 0
  let skippedCount = 0
  let cancelledCount = 0
  const cancelledBookingIds: string[] = []
  const supersededEntries: SupersededEntry[] = []
  const errors: string[] = []

  // Helper: facility name lookup (cache to avoid N+1)
  const facilityNameCache = new Map<string, string>()
  const facilityIds = [...new Set(approvedEntries.map(e => e.facility_id).filter(Boolean))]
  if (facilityIds.length > 0) {
    const { data: facs } = await supabase
      .from('facilities')
      .select('id, name')
      .in('id', facilityIds as string[])
    for (const f of facs ?? []) facilityNameCache.set(f.id, f.name)
  }

  for (const entry of approvedEntries) {
    const effectiveStart = entry.effective_start_date ?? upload.batch_effective_date ?? term?.start_date ?? null
    const effectiveEnd = entry.effective_end_date ?? upload.batch_effective_end_date ?? term?.end_date ?? null

    // 5a. Find overlapping class_schedules from OTHER departments.
    const { data: overlapping } = await supabase
      .from('class_schedules')
      .select('id, department_id, schedule_upload_id, course_code, section, day_of_week, start_time, end_time, effective_start_date, effective_end_date, facility_id')
      .eq('facility_id', entry.facility_id)
      .eq('day_of_week', entry.day_of_week)
      .eq('is_active', true)
      .lt('start_time', entry.end_time)
      .gt('end_time', entry.start_time)

    const conflicts: OverlappingSchedule[] = ((overlapping ?? []) as OverlappingSchedule[]).filter((c) => {
      // date-range overlap check
      const cStart = c.effective_start_date
      const cEnd = c.effective_end_date
      if (!effectiveStart || !cStart) return true
      if (effectiveEnd && cEnd) {
        return cStart <= effectiveEnd && cEnd >= effectiveStart
      }
      if (effectiveEnd && !cEnd) return cStart <= effectiveEnd
      if (!effectiveEnd && cEnd) return cEnd >= effectiveStart
      return true
    })

    const sameDeptConflict = conflicts.find((c) => c.department_id === upload.department_id)
    if (sameDeptConflict) {
      skippedCount++
      errors.push(`Row ${entry.row_number}: same-department duplicate — already on the live schedule for this facility/time.`)
      continue
    }

    // 5b–5d (atomic). One RPC releases the overlapping schedules, inserts the new
    // one, links superseded_by, and flags the staging entry as published — all in
    // a single DB transaction. A crash can no longer leave a slot released without
    // a replacement. Notifications + booking cancellation stay in JS below.
    const supersedeReason = `Superseded by Academic Head publish (upload ${uploadId})`
    const { data: newScheduleId, error: publishErr } = await supabase.rpc('publish_schedule_entry', {
      p_entry_id: entry.id,
      p_upload_id: uploadId,
      p_conflict_ids: conflicts.map((c) => c.id),
      p_effective_start: effectiveStart,
      p_effective_end: effectiveEnd,
      p_supersede_reason: supersedeReason,
    })

    if (publishErr || !newScheduleId) {
      // The transaction rolled back wholesale — nothing was deactivated or inserted.
      skippedCount++
      errors.push(`Row ${entry.row_number}: ${publishErr?.message ?? 'publish failed'}`)
      continue
    }

    publishedCount++
    const newSchedule = { id: newScheduleId as string }
    const deactivatedConflicts = conflicts

    // 5d. Record each supersede for notifications + audit (FK already linked in RPC).
    for (const conflict of deactivatedConflicts) {
      // Resolve old uploader (may be null on legacy rows).
      let oldUploaderId: string | null = null
      if (conflict.schedule_upload_id) {
        const { data: oldUpload } = await supabase
          .from('schedule_uploads')
          .select('uploaded_by')
          .eq('id', conflict.schedule_upload_id)
          .single()
        oldUploaderId = oldUpload?.uploaded_by ?? null
      }

      supersededEntries.push({
        oldScheduleId: conflict.id,
        oldUploadId: conflict.schedule_upload_id ?? null,
        oldUploaderId,
        newScheduleId: newSchedule.id,
        courseCode: entry.course_code ?? '—',
        section: entry.section ?? '',
        facilityName: facilityNameCache.get(entry.facility_id ?? '') ?? '—',
        dayTime: `${DAY_NAMES[entry.day_of_week] ?? '—'} ${String(entry.start_time).slice(0, 5)} – ${String(entry.end_time).slice(0, 5)}`,
      })
    }

    // 5e. Auto-cancel overlapping bookings (mirrors the review/publish loop).
    const { data: overlappingBookings } = await supabase
      .from('bookings')
      .select('id, user_id, booking_reference, booking_date, start_time, end_time')
      .eq('facility_id', entry.facility_id)
      .in('current_status', ['pending', 'approved', 'auto_approved', 'pending_user_response'])
      .gte('booking_date', effectiveStart ?? new Date().toISOString().split('T')[0])
      .lte('booking_date', effectiveEnd ?? '9999-12-31')

    for (const booking of overlappingBookings ?? []) {
      const bookingDow = new Date(booking.booking_date as string).getDay()
      if (bookingDow !== entry.day_of_week) continue
      if (!((booking.start_time as string) < entry.end_time && (booking.end_time as string) > entry.start_time)) continue

      const { error: cancelErr } = await supabase
        .from('bookings')
        .update({
          current_status: 'cancelled',
          cancelled_by_schedule_id: newSchedule.id,
        })
        .eq('id', booking.id)

      if (!cancelErr) {
        cancelledBookingIds.push(booking.id)
        cancelledCount++
        await sendNotification(supabase, {
          user_id: booking.user_id,
          title: 'Reservation Cancelled by Class Schedule',
          message: `Your booking ${booking.booking_reference} was cancelled because a class schedule (${entry.course_code} ${entry.section}) was published for this time slot.`,
          type: 'warning',
          source_type: 'booking',
          source_id: booking.id,
          priority: 'high',
          action_url: `/client/reservations/${booking.id}`,
          metadata: {
            cancelled_by_schedule_id: newSchedule.id,
            schedule_upload_id: uploadId,
            course_code: entry.course_code,
            section: entry.section,
            booking_reference: booking.booking_reference,
          },
        })
      }
    }
  }

  // 6. Set upload status.
  const { count: remainingErrors } = await supabase
    .from('schedule_entries_staging')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_upload_id', uploadId)
    .eq('validation_status', 'error')

  const finalStatus = (remainingErrors ?? 0) === 0 && skippedCount === 0
    ? 'approved'
    : 'partially_approved'

  await supabase
    .from('schedule_uploads')
    .update({
      upload_status: finalStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', uploadId)

  // 7. Publish-log entry (keeps the bespoke supplementary log in sync).
  await supabase
    .from('schedule_publish_log')
    .insert({
      schedule_upload_id: uploadId,
      published_by: user.id,
      effective_date: upload.batch_effective_date ?? term?.start_date ?? new Date().toISOString().split('T')[0],
      entries_published: publishedCount,
      reservations_cancelled: cancelledCount,
      cancelled_booking_ids: cancelledBookingIds,
    })

  // 8. Audit logs — one per upload, one per supersede.
  try {
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'schedule_upload_self_published',
      target_type: 'schedule_upload',
      target_id: uploadId,
      details: {
        entriesPublished: publishedCount,
        entriesSkipped: skippedCount,
        cancelledBookingCount: cancelledCount,
        supersededCount: supersededEntries.length,
        finalStatus,
      },
    })

    if (supersededEntries.length > 0) {
      await supabase.from('audit_logs').insert(
        supersededEntries.map(s => ({
          actor_id: user.id,
          action: 'schedule_entry_superseded',
          target_type: 'class_schedule',
          target_id: s.oldScheduleId,
          details: {
            replacing_schedule_id: s.newScheduleId,
            replacing_upload_id: uploadId,
            old_upload_id: s.oldUploadId,
            old_uploader_id: s.oldUploaderId,
            course_code: s.courseCode,
            section: s.section,
            facility: s.facilityName,
            day_time: s.dayTime,
          },
        })),
      )
    }
  } catch (auditErr) {
    console.error('[publish-self] audit_logs insert failed:', auditErr)
  }

  // 9. Notify each superseded uploader once (batched by old_uploader_id).
  if (supersededEntries.length > 0) {
    const byUploader = new Map<string, SupersededEntry[]>()
    for (const s of supersededEntries) {
      if (!s.oldUploaderId || s.oldUploaderId === user.id) continue
      if (!byUploader.has(s.oldUploaderId)) byUploader.set(s.oldUploaderId, [])
      byUploader.get(s.oldUploaderId)!.push(s)
    }

    for (const [uploaderId, entries] of byUploader) {
      const dashboardPath = `/program/schedules/uploads/${uploadId}`
      await sendNotification(supabase, {
        user_id: uploaderId,
        title: 'Schedule Entries Superseded',
        message: `${entries.length} of your published class schedule entries were superseded by ${user.full_name ?? 'an Academic Head'}.`,
        type: 'warning',
        source_type: 'schedule_upload',
        source_id: uploadId,
        priority: 'high',
        action_url: dashboardPath,
        metadata: {
          replacing_upload_id: uploadId,
          superseded_count: entries.length,
          superseded_by: user.id,
          entries: entries.map(e => ({
            course_code: e.courseCode,
            section: e.section,
            facility: e.facilityName,
            day_time: e.dayTime,
            old_schedule_id: e.oldScheduleId,
            new_schedule_id: e.newScheduleId,
          })),
        },
      })

      void (async () => {
        try {
          const { data: uploader } = await supabase
            .from('users')
            .select('full_name, email, notification_email')
            .eq('id', uploaderId)
            .single()
          if (!uploader) return
          const to = (uploader as any).notification_email ?? null
          if (!to) {
            console.warn(`[publish] Uploader ${uploaderId} has no notification_email set — supersede email skipped`)
            return
          }
          const { subject, htmlBody } = scheduleSupersededEmail({
            uploaderName: (uploader as any).full_name ?? 'Submitter',
            supersededByName: user.full_name ?? user.email ?? 'Academic Head',
            supersededAt: new Date().toLocaleString('en-PH', {
              timeZone: 'Asia/Manila',
              year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            }),
            entries: entries.map(e => ({
              courseCode: e.courseCode,
              section: e.section,
              dayTime: e.dayTime,
              facility: e.facilityName,
            })),
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}${dashboardPath}`,
          })
          await sendBrevoEmail({ to, subject, htmlBody })
        } catch (err) {
          console.error('[publish-self] supersede email failed:', err)
        }
      })()
    }
  }

  return NextResponse.json({
    success: true,
    upload_status: finalStatus,
    entries_published: publishedCount,
    entries_skipped: skippedCount,
    reservations_cancelled: cancelledCount,
    cancelled_booking_ids: cancelledBookingIds,
    superseded_count: supersededEntries.length,
    superseded_uploaders: [...new Set(supersededEntries.map(s => s.oldUploaderId).filter(Boolean))].length,
    errors,
  })
}
