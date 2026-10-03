import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { proposeEmergencyReschedule } from '@/backend/booking/emergencyRescheduleHandler'
import { getErrorMessage } from '@/lib/errors'

const Schema = z.object({
  new_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  new_start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
  new_end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
  new_facility_id: z.string().uuid().optional(),
  custom_message: z.string().max(2000).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
  }

  try {
    const { id } = await params
    const supabase = createAdminClient()
    const result = await proposeEmergencyReschedule(supabase, {
      bookingId: id,
      adminUserId: user!.id,
      newDate: parsed.data.new_date,
      newStartTime: parsed.data.new_start_time,
      newEndTime: parsed.data.new_end_time,
      newFacilityId: parsed.data.new_facility_id,
      customMessage: parsed.data.custom_message,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 422 })
    }

    return NextResponse.json({ success: true, message: result.message, override_id: result.overrideId })
  } catch (err) {
    console.error('[emergency-reschedule] 500 exception:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
