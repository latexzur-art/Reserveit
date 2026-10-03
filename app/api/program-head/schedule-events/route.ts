import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
import { NotificationService } from '@/backend/notifications/notification.service'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  specialEventReviewRequestEmail,
  specialEventInstantPublishedEmail,
} from '@/backend/notifications/emailTemplates'
import { voidConflictsForSchoolEvent } from '@/backend/schedule-events/voidSchoolEventConflicts'

export async function GET() {
    const { error, user } = await requireProgramHead()
    if (error) return error

    const supabase = createAdminClient()

    // Auto-complete any past approved events submitted by this user
    await supabase.rpc('auto_complete_past_bookings', { p_user_id: user!.id })

    try {
        const { data: events, error: dbError } = await supabase
            .from('bookings')
            .select(`
                id,
                booking_date,
                start_time,
                end_time,
                event_name,
                current_status,
                booking_facilities!inner (
                    facility_id,
                    facilities ( name, room_number )
                )
            `)
            .eq('booking_type', 'school_event_block')
            .eq('user_id', user!.id)
            .order('booking_date', { ascending: false })

        if (dbError) throw dbError

        const transformedEvents = (events ?? []).map((event: any) => ({
            ...event,
            facility_id: event.booking_facilities?.[0]?.facility_id,
            facilities: event.booking_facilities?.[0]?.facilities,
        }))

        return NextResponse.json({ events: transformedEvents })
    } catch (err: any) {
        console.error('Program head school events GET error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const { error, user } = await requireProgramHead()
    if (error) return error

    const supabase = createAdminClient()

    try {
        const body = await request.json()
        const { event_name, booking_date, start_time, end_time, facility_ids, facility_id } = body

        // Accept either facility_ids (array) or legacy facility_id (single)
        const facilityList: string[] = facility_ids?.length
            ? facility_ids
            : facility_id ? [facility_id] : []

        if (!event_name || !booking_date || facilityList.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const resolvedStart = start_time || '00:00'
        const resolvedEnd = end_time || '23:59'

        const userRoles = (user!.roles ?? []).map((r: { name: string }) => r.name)
        const isPrivileged = userRoles.some((r: string) => ['academic_head', 'building_admin'].includes(r))
        const isProgramHead = !isPrivileged && userRoles.includes('program_head')
        const requestedByRole = isPrivileged
            ? (userRoles.includes('academic_head') ? 'academic_head' : 'building_admin')
            : 'program_head'

        const insertStatus = isProgramHead ? 'pending' : 'auto_approved'

        // Create the booking record
        const { data: newBooking, error: createError } = await supabase
            .from('bookings')
            .insert({
                user_id: user!.id,
                booking_reference: '',
                booking_type: 'school_event_block',
                booking_purpose: 'school_event',
                booking_date,
                start_time: resolvedStart,
                end_time: resolvedEnd,
                purpose: event_name,
                event_name,
                current_status: insertStatus,
                event_requires_approval: isProgramHead,
                event_approval_status: isProgramHead ? 'pending' : null,
                event_requested_by_role: requestedByRole,
            })
            .select('id')
            .single()

        if (createError) throw createError

        // Insert one row per facility
        const facilityRows = facilityList.map((fid: string) => ({
            booking_id: newBooking.id,
            facility_id: fid,
        }))
        const { error: facError } = await supabase.from('booking_facilities').insert(facilityRows)
        if (facError) throw facError

        // Resolve facility names for notifications
        const { data: facilityData } = await supabase
            .from('facilities')
            .select('name')
            .in('id', facilityList)
        const facilityNames = (facilityData ?? []).map((f: any) => f.name).join(', ')

        // Requester's display name and email
        const requesterName = user!.full_name ?? user!.email ?? 'Program Head'

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

        if (isProgramHead) {
            // Notify reviewers (AH + BA) in-app
            await NotificationService.createForRoles(['academic_head', 'building_admin'], {
                title: 'Special Event Request Pending Review',
                message: `${requesterName} submitted a special event: "${event_name}" on ${booking_date} (${resolvedStart}–${resolvedEnd}).`,
                type: 'info',
                source_type: 'special_event',
                source_id: newBooking.id,
                priority: 'high',
                action_url: `${baseUrl}/academic/special-events/queue`,
            })

            // Email reviewers (AH + BA)
            const { data: reviewerUsers } = await supabase
                .from('user_roles')
                .select('users!inner(email, full_name)')
                .in('roles.name', ['academic_head', 'building_admin'])
                .eq('is_active', true)

            for (const ru of (reviewerUsers as any[] ?? [])) {
                const reviewer = Array.isArray(ru.users) ? ru.users[0] : ru.users
                if (!reviewer?.email) continue
                const { subject, htmlBody } = specialEventReviewRequestEmail({
                    reviewerName: reviewer.full_name ?? reviewer.email,
                    requesterName,
                    requesterRole: 'Program Head',
                    eventName: event_name,
                    eventDate: booking_date,
                    startTime: resolvedStart,
                    endTime: resolvedEnd,
                    facilities: facilityNames,
                    reviewUrl: `${baseUrl}/academic/special-events/queue`,
                })
                await sendBrevoEmail({ to: reviewer.email, subject, htmlBody })
            }
        } else {
            // AH or BA — auto-approved, offer reschedule to anyone displaced
            await voidConflictsForSchoolEvent(
                supabase,
                facilityList,
                booking_date,
                resolvedStart,
                resolvedEnd,
                event_name,
                newBooking.id,
                'offer_reschedule',
            )

            // FYI notification to the other reviewer role
            const otherRole = requestedByRole === 'academic_head' ? 'building_admin' : 'academic_head'
            await NotificationService.createForRoles([otherRole], {
                title: `School Event Published: ${event_name}`,
                message: `${requesterName} published a school event: "${event_name}" on ${booking_date}.`,
                type: 'info',
                source_type: 'special_event',
                source_id: newBooking.id,
                priority: 'normal',
                action_url: `${baseUrl}/admin/building/calendar`,
            })

            // FYI email to other reviewer role
            const { data: otherUsers } = await supabase
                .from('user_roles')
                .select('users!inner(email, full_name), roles!inner(name)')
                .eq('roles.name', otherRole)
                .eq('is_active', true)

            const creatorRole = requestedByRole === 'academic_head' ? 'Academic Head' : 'Building Admin'
            for (const ru of (otherUsers as any[] ?? [])) {
                const reviewer = Array.isArray(ru.users) ? ru.users[0] : ru.users
                if (!reviewer?.email) continue
                const { subject, htmlBody } = specialEventInstantPublishedEmail({
                    reviewerName: reviewer.full_name ?? reviewer.email,
                    creatorName: requesterName,
                    creatorRole,
                    eventName: event_name,
                    eventDate: booking_date,
                    startTime: resolvedStart,
                    endTime: resolvedEnd,
                    facilities: facilityNames,
                    dashboardUrl: `${baseUrl}/admin/building/calendar`,
                })
                await sendBrevoEmail({ to: reviewer.email, subject, htmlBody })
            }
        }

        return NextResponse.json({ success: true, id: newBooking.id, requiresApproval: isProgramHead })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
