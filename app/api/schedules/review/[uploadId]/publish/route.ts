/**
 * POST /api/schedules/review/[uploadId]/publish
 * Academic Head: publish approved entries to class_schedules and cancel conflicting bookings.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { schedulePublishedEmail } from '@/backend/notifications/emailTemplates'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ uploadId: string }> },
) {
    const { error: authError, user } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

    const { uploadId } = await params
    const supabase = createAdminClient()

    // Verify upload exists and is in a publishable state
    const { data: upload, error: fetchErr } = await supabase
        .from('schedule_uploads')
        .select('id, upload_status, academic_term_id, department_id, batch_effective_date, batch_effective_end_date, uploaded_by')
        .eq('id', uploadId)
        .single()

    if (fetchErr || !upload) {
        return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
    }

    // department_id may be null on legacy uploads — fall back to the uploader's department
    let departmentId = upload.department_id
    if (!departmentId) {
        const { data: uploaderProfile } = await supabase
            .from('users')
            .select('department_id')
            .eq('id', upload.uploaded_by)
            .single()
        departmentId = uploaderProfile?.department_id ?? null
    }
    if (!departmentId) {
        return NextResponse.json({ error: 'Cannot determine department for this upload. Ensure the uploader has a department assigned.' }, { status: 400 })
    }

    if (!['pending_submission', 'submitted', 'under_review', 'partially_approved', 'approved', 'rejected'].includes(upload.upload_status)) {
        return NextResponse.json({ error: `Cannot publish upload in '${upload.upload_status}' state` }, { status: 400 })
    }

    // Get term dates for fallback
    const { data: term } = await supabase
        .from('academic_terms')
        .select('start_date, end_date')
        .eq('id', upload.academic_term_id)
        .single()

    // Get all academic_head_approved entries with resolved facilities and no live conflicts
    const { data: allApproved, error: entriesErr } = await supabase
        .from('schedule_entries_staging')
        .select('*')
        .eq('schedule_upload_id', uploadId)
        .eq('academic_head_review_status', 'academic_head_approved')
        .not('facility_id', 'is', null)

    if (entriesErr) {
        return NextResponse.json({ error: entriesErr.message }, { status: 500 })
    }

    const errors: string[] = []

    // Split into publishable and conflicted — conflicted entries go back to pending
    const approved = (allApproved ?? []).filter(e => !e.has_external_conflict)
    const conflicted = (allApproved ?? []).filter(e => e.has_external_conflict)

    for (const entry of conflicted) {
        await supabase
            .from('schedule_entries_staging')
            .update({
                academic_head_review_status: 'pending_review',
                academic_head_review_notes: 'Skipped: live schedule conflict detected. Resolve the conflict before publishing.',
            })
            .eq('id', entry.id)
        errors.push(`Row ${entry.row_number ?? '?'}: Skipped — live schedule conflict. Re-assign room or time.`)
    }

    console.log(`[publish] uploadId=${uploadId} publishable: ${approved.length}, skipped (conflict): ${conflicted.length}`)
    if (approved.length === 0) {
        return NextResponse.json({ error: 'No approved entries without conflicts to publish', errors }, { status: 400 })
    }

    // Check if any approved entry has pending validation errors
    const hasErrors = approved.some(e => e.validation_status === 'error')
    if (hasErrors) {
        return NextResponse.json({ error: 'Cannot publish schedule: Some approved entries still have validation errors. Please fix them before publishing.' }, { status: 400 })
    }

    let publishedCount = 0
    let cancelledCount = 0
    const cancelledBookingIds: string[] = []

    for (const entry of approved) {
        const effectiveStart = entry.effective_start_date
            ?? upload.batch_effective_date
            ?? term?.start_date
        const effectiveEnd = entry.effective_end_date
            ?? upload.batch_effective_end_date
            ?? term?.end_date

        // Insert into class_schedules
        const { data: newSchedule, error: insertErr } = await supabase
            .from('class_schedules')
            .insert({
                schedule_upload_id: uploadId,
                staging_entry_id: entry.id,
                academic_term_id: upload.academic_term_id,
                department_id: departmentId,
                facility_id: entry.facility_id,
                course_code: entry.course_code,
                course_name: entry.course_name,
                session_type: entry.session_type,
                section: entry.section,
                instructor_id: entry.instructor_id,
                instructor_name: entry.instructor_name,
                day_of_week: entry.day_of_week,
                start_time: entry.start_time,
                end_time: entry.end_time,
                effective_start_date: effectiveStart,
                effective_end_date: effectiveEnd,
                is_active: true,
                version: 1,
            })
            .select('id')
            .single()

        if (insertErr) {
            let errorMsg = insertErr.message
            if (insertErr.message.includes('class_schedules_no_overlap_idx')) {
                errorMsg = 'Failed to publish: Schedule overlap detected in live database.'
            }

            console.error(`[publish] insert failed for entry ${entry.id} (row ${entry.row_number}):`, insertErr.message)
            errors.push(`Row ${entry.row_number ?? '?'}: ${errorMsg}`)

            // Reset to pending so the entry reappears in the review queue for re-assignment
            await supabase
                .from('schedule_entries_staging')
                .update({
                    academic_head_review_status: 'pending_review',
                    academic_head_review_notes: errorMsg,
                    ...(errorMsg.includes('overlap') || errorMsg.includes('conflict') ? { has_external_conflict: true } : {})
                })
                .eq('id', entry.id)

            continue
        }

        publishedCount++

        await supabase
            .from('schedule_entries_staging')
            .update({ is_published: true })
            .eq('id', entry.id)

        // Cancel conflicting bookings for this time slot
        if (newSchedule && effectiveStart && effectiveEnd) {
            const { data: conflicts } = await supabase
                .from('booking_facilities')
                .select('booking_id, bookings!inner(id, booking_date, start_time, end_time, current_status)')
                .eq('facility_id', entry.facility_id)
                .in('bookings.current_status', ['pending', 'approved'])

            if (conflicts) {
                for (const bf of conflicts) {
                    const booking: any = Array.isArray(bf.bookings) ? bf.bookings[0] : bf.bookings
                    if (!booking) continue

                    const bookingDate = new Date(booking.booking_date)
                    const bookingDow = bookingDate.getUTCDay()

                    if (bookingDow !== entry.day_of_week) continue
                    if (booking.booking_date < effectiveStart || booking.booking_date > effectiveEnd) continue
                    if (!(booking.start_time < entry.end_time && booking.end_time > entry.start_time)) continue

                    // Get booking details for notification
                    const { data: bookingDetails } = await supabase
                        .from('bookings')
                        .select('user_id, booking_reference, booking_date')
                        .eq('id', booking.id)
                        .single()

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

                        // Send notification to affected faculty
                        if (bookingDetails) {
                            await sendNotification(supabase, {
                                user_id: bookingDetails.user_id,
                                title: 'Reservation Cancelled by Class Schedule',
                                message: `Your booking ${bookingDetails.booking_reference} was cancelled because a class schedule (${entry.course_code} ${entry.section}) was published for this time slot.`,
                                type: 'warning',
                                source_type: 'schedule',
                                source_id: newSchedule.id,
                                priority: 'high',
                            })
                        }
                    }
                }
            }
        }
    }

    // Update upload status
    const { count: remaining } = await supabase
        .from('schedule_entries_staging')
        .select('id', { count: 'exact', head: true })
        .eq('schedule_upload_id', uploadId)
        .in('academic_head_review_status', ['pending_review', 'academic_head_flagged'])

    const finalStatus = (remaining ?? 0) === 0 ? 'approved' : 'partially_approved'

    await supabase
        .from('schedule_uploads')
        .update({
            upload_status: finalStatus,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', uploadId)

    // Log publish event
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

    // Audit log
    try {
        await supabase.from('audit_logs').insert({
            actor_id: user.id,
            action: 'schedule_upload_published',
            target_type: 'schedule_upload',
            target_id: uploadId,
            details: {
                entriesPublished: publishedCount,
                cancelledBookingCount: cancelledCount,
                finalStatus,
            },
        })
    } catch (auditErr) {
        console.error('[review/publish] audit_logs insert failed:', auditErr)
    }

    // Notify the program head (uploader) that their schedule was published
    if (upload.uploaded_by) {
        await sendNotification(supabase, {
            user_id: upload.uploaded_by,
            title: finalStatus === 'approved' ? 'Schedule Published' : 'Schedule Partially Published',
            message: `Your schedule upload has been reviewed and ${publishedCount} entr${publishedCount === 1 ? 'y' : 'ies'} were published to the live schedule.${cancelledCount > 0 ? ` ${cancelledCount} conflicting booking${cancelledCount === 1 ? '' : 's'} were automatically cancelled.` : ''}`,
            type: finalStatus === 'approved' ? 'success' : 'warning',
            source_type: 'schedule_upload',
            source_id: uploadId,
            priority: 'high',
            metadata: {
                upload_id: uploadId,
                entries_published: publishedCount,
                reservations_cancelled: cancelledCount,
                upload_status: finalStatus,
                decided_by_name: user.full_name ?? user.email,
                decided_by_role: 'Academic Head',
            },
        })

        void (async () => {
            try {
                const { data: uploader } = await supabase
                    .from('users')
                    .select('full_name, email, notification_email')
                    .eq('id', upload.uploaded_by)
                    .single()
                if (uploader) {
                    const to = (uploader as any).notification_email ?? null
                    if (!to) {
                        console.warn(`[review/publish] Uploader ${upload.uploaded_by} has no notification_email set — published email skipped`)
                    } else {
                        const { subject, htmlBody } = schedulePublishedEmail({
                            userName: (uploader as any).full_name ?? 'Submitter',
                            entriesPublished: publishedCount,
                            reservationsCancelled: cancelledCount,
                            uploadStatus: finalStatus as 'approved' | 'partially_approved',
                            reviewedByName: user.full_name ?? user.email ?? 'Academic Head',
                        })
                        await sendBrevoEmail({ to, subject, htmlBody })
                    }
                }
            } catch {}
        })()
    }

    return NextResponse.json({
        entries_published: publishedCount,
        reservations_cancelled: cancelledCount,
        cancelled_booking_ids: cancelledBookingIds,
        upload_status: finalStatus,
        errors,
    })
}
