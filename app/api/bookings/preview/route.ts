import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { previewBookingScore } from '@/backend/booking/scorePreview'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getErrorMessage, getErrorDetails } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const PreviewSchema = z.object({
  facility_id: z.string().uuid(),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM or HH:MM:SS').transform(t => t.slice(0, 5)),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM or HH:MM:SS').transform(t => t.slice(0, 5)),
  booking_purpose: z.enum(['academic', 'school_event', 'department_use', 'personal', 'commercial', 'community']),
  purpose: z.string().optional(),
  event_name: z.string().optional(),
  expected_attendees: z.number().int().positive().optional(),
  special_requests: z.string().optional(),
  facility_purpose_category: z.string().optional(),
  mismatch_justification: z.string().optional(),
  booking_course_code: z.string().optional(),
  booking_department_code: z.string().optional(),
  session_type: z.enum(['lecture', 'lab']).nullable().optional(),
})

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const rateLimited = checkRateLimit(`preview:${user.id}`, RATE_LIMITS.BOOKING_CREATE)
  if (rateLimited) return rateLimited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PreviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const fields = parsed.data
  const supabase = createAdminClient()

  // Grab the user department using their RPC structure (if needed)
  const { data: dbUser } = await supabase
    .from('users')
    .select('department_id')
    .eq('id', user.id)
    .single()

  let userDepartment = null
  if (dbUser?.department_id) {
    const { data: dept } = await supabase
      .from('departments')
      .select('id, code, name')
      .eq('id', dbUser.department_id)
      .single()
    if (dept) {
      userDepartment = dept
    }
  }

  const userProfile = {
    id: user.id,
    user_type: user.user_type,
    account_status: (user as any).account_status ?? 'active',
    roles: user.roles ?? [],
    department: userDepartment,
  }

  try {
    const preview = await previewBookingScore(supabase, userProfile, fields)
    
    // Check overlap
    const { data: overlapRows } = await supabase
      .from('booking_facilities')
      .select('booking_id, bookings!inner(id, booking_reference, start_time, end_time, current_status)')
      .eq('facility_id', fields.facility_id)
      .eq('bookings.booking_date', fields.booking_date)
      .in('bookings.current_status', ['pending', 'flagged', 'auto_approved', 'approved'])
      .lt('bookings.start_time', fields.end_time)
      .gt('bookings.end_time', fields.start_time)
      .limit(1)

    if (overlapRows && overlapRows.length > 0) {
      return NextResponse.json({
        status: 'conflict',
        message: 'Time slot already booked for this facility',
      }, { status: 200 })
    }

    return NextResponse.json(preview, { status: 200 })
  } catch (err: unknown) {
    const message = getErrorMessage(err)
    console.error('[API] POST /bookings/preview error:', getErrorDetails(err))
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
