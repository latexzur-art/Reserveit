import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { NotificationService } from '@/backend/notifications/notification.service'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  specialEventApprovedEmail,
  specialEventDeclinedEmail,
} from '@/backend/notifications/emailTemplates'
import { voidConflictsForSchoolEvent } from '@/backend/schedule-events/voidSchoolEventConflicts'

/**
 * PATCH /api/admin/special-events/[id]/review
 * Approve or decline a program-head special-event request.
 * Accessible by academic_head and building_admin.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
  if (authError) return authError

  const { user: reviewer } = await getAuthUserWithRoles()
  if (!reviewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { action, notes } = body

  if (!['approve', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'action must be "approve" or "decline"' }, { status: 400 })
  }
  if (action === 'decline' && (!notes || !String(notes).trim())) {
    return NextResponse.json({ error: 'A reason is required when declining' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Fetch event + requester info
  const { data: event, error: fetchError } = await supabase
    .from('bookings')
    .select(`
      id, event_name, booking_date, start_time, end_time, current_status,
      event_approval_status, event_requires_approval, event_requested_by_role, user_id,
      users!bookings_user_id_fkey ( id, full_name, email ),
      booking_facilities ( facility_id, facilities ( name ) )
    `)
    .eq('id', id)
    .eq('booking_type', 'school_event_block')
    .single()

  if (fetchError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (!event.event_requires_approval) {
    return NextResponse.json({ error: 'This event does not require approval' }, { status: 400 })
  }
  if (event.event_approval_status !== 'pending') {
    return NextResponse.json({ error: 'This event has already been reviewed' }, { status: 409 })
  }

  const reviewerRoles = (reviewer.roles ?? []).map((r: { name: string }) => r.name)
  const reviewerRole = reviewerRoles.includes('academic_head') ? 'Academic Head' : 'Building Admin'
  const reviewerName = reviewer.full_name ?? reviewer.email ?? reviewerRole

  const requesterRaw = Array.isArray(event.users) ? event.users[0] : event.users
  const requesterName = requesterRaw?.full_name ?? requesterRaw?.email ?? 'Program Head'
  const requesterEmail = requesterRaw?.email

  const facilityIds = (event.booking_facilities ?? []).map((bf: any) => bf.facility_id)
  const facilityNames = (event.booking_facilities ?? [])
    .map((bf: any) => (Array.isArray(bf.facilities) ? bf.facilities[0]?.name : bf.facilities?.name))
    .filter(Boolean)
    .join(', ')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const now = new Date().toISOString()

  if (action === 'approve') {
    // Approve the event
    await supabase
      .from('bookings')
      .update({
        current_status: 'auto_approved',
        event_approval_status: 'approved',
        event_decision_notes: notes ?? null,
        event_decided_by: reviewer.id,
        event_decided_at: now,
      })
      .eq('id', id)

    // Offer reschedule to anyone displaced by the event
    const { bookingsVoided, schedulesVoided } = await voidConflictsForSchoolEvent(
      supabase,
      facilityIds,
      event.booking_date,
      event.start_time,
      event.end_time,
      event.event_name,
      id,
      'offer_reschedule',
    )

    // In-app notification to requester
    if (event.user_id) {
      await NotificationService.create({
        user_id: event.user_id,
        title: `Special Event Approved: ${event.event_name}`,
        message: `Your event request has been approved by ${reviewerName}${notes ? `: "${notes}"` : '.'} ${bookingsVoided} booking(s) and ${schedulesVoided} class session(s) were displaced.`,
        type: 'success',
        source_type: 'special_event',
        source_id: id,
        priority: 'high',
        action_url: `${baseUrl}/program/reservations`,
      })
    }

    // Email requester
    if (requesterEmail) {
      const { subject, htmlBody } = specialEventApprovedEmail({
        requesterName,
        eventName: event.event_name,
        eventDate: event.booking_date,
        startTime: event.start_time,
        endTime: event.end_time,
        facilities: facilityNames,
        decidedBy: reviewerName,
        notes: notes ?? undefined,
        dashboardUrl: `${baseUrl}/program/reservations`,
      })
      await sendBrevoEmail({ to: requesterEmail, subject, htmlBody })
    }

    // Broadcast decision to the other reviewer role
    const otherRole = reviewerRoles.includes('academic_head') ? 'building_admin' : 'academic_head'
    await NotificationService.createForRoles([otherRole], {
      title: `Special Event Approved: ${event.event_name}`,
      message: `${reviewerName} approved the special event "${event.event_name}" on ${event.booking_date}.`,
      type: 'success',
      source_type: 'special_event',
      source_id: id,
      priority: 'normal',
    })

    return NextResponse.json({ success: true, action: 'approve', bookingsVoided, schedulesVoided })
  }

  // action === 'decline'
  await supabase
    .from('bookings')
    .update({
      current_status: 'cancelled',
      cancellation_type: 'admin_cancelled',
      event_approval_status: 'declined',
      event_decision_notes: notes,
      event_decided_by: reviewer.id,
      event_decided_at: now,
    })
    .eq('id', id)

  // In-app notification to requester
  if (event.user_id) {
    await NotificationService.create({
      user_id: event.user_id,
      title: `Special Event Declined: ${event.event_name}`,
      message: `Your event request was declined by ${reviewerName}. Reason: ${notes}`,
      type: 'error',
      source_type: 'special_event',
      source_id: id,
      priority: 'high',
      action_url: `${baseUrl}/program/reservations`,
    })
  }

  // Email requester
  if (requesterEmail) {
    const { subject, htmlBody } = specialEventDeclinedEmail({
      requesterName,
      eventName: event.event_name,
      eventDate: event.booking_date,
      decidedBy: reviewerName,
      reason: notes,
      dashboardUrl: `${baseUrl}/program/reservations`,
    })
    await sendBrevoEmail({ to: requesterEmail, subject, htmlBody })
  }

  // Broadcast decision to other reviewer role
  const otherRole = reviewerRoles.includes('academic_head') ? 'building_admin' : 'academic_head'
  await NotificationService.createForRoles([otherRole], {
    title: `Special Event Declined: ${event.event_name}`,
    message: `${reviewerName} declined the special event "${event.event_name}" on ${event.booking_date}. Reason: ${notes}`,
    type: 'warning',
    source_type: 'special_event',
    source_id: id,
    priority: 'normal',
  })

  return NextResponse.json({ success: true, action: 'decline' })
}
