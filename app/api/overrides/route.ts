import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdmin } from '@/lib/auth/guards'
import { handleOverride } from '@/backend/booking'

const OverrideSchema = z.object({
  booking_id: z.string().uuid(),
  action: z.enum(['cancel', 'reschedule', 'change_facility']),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
  new_values: z
    .object({
      facility_id: z.string().uuid().optional(),
      booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    })
    .optional(),
})

export async function POST(request: NextRequest) {
  const { error, user: admin } = await requireBuildingAdmin()
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = OverrideSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const result = await handleOverride(supabase, {
      bookingId: parsed.data.booking_id,
      adminUserId: admin.id,
      action: parsed.data.action,
      reason: parsed.data.reason,
      newValues: parsed.data.new_values,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] POST /overrides error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
