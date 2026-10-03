import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { getSuggestions } from '@/backend/booking'

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const failedCode = searchParams.get('failed_code')
  const facilityId = searchParams.get('facility_id')
  const date = searchParams.get('date')
  const startTime = searchParams.get('start_time')
  const endTime = searchParams.get('end_time')
  const expectedAttendees = searchParams.get('expected_attendees')
  const bookingPurpose = searchParams.get('booking_purpose')

  if (!failedCode || !facilityId || !date || !startTime || !endTime) {
    return NextResponse.json(
      { error: 'Required: failed_code, facility_id, date, start_time, end_time' },
      { status: 400 }
    )
  }

  try {
    const supabase = createAdminClient()

    const suggestions = await getSuggestions(supabase, failedCode, {
      booking_id: '',
      created_at: new Date().toISOString(),
      user_id: user.id,
      user_type: (user.user_type ?? 'internal') as 'internal' | 'external',
      user_roles: (user.roles ?? []).map((r: { name: string }) => r.name),
      account_status: (user as any).accountStatus ?? user.account_status ?? 'active',
      user_department_id: null, // Not needed for suggestions
      user_department_code: null,
      facility_id: facilityId,
      booking_date: date,
      start_time: startTime,
      end_time: endTime,
      purpose: '',
      booking_purpose: (bookingPurpose as 'academic') ?? 'academic',
      expected_attendees: expectedAttendees ? parseInt(expectedAttendees) : undefined,
    })

    return NextResponse.json({ suggestions })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] GET /bookings/suggestions error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
