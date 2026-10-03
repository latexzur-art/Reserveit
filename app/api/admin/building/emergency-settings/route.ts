import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { getEmergencySettings } from '@/backend/booking/emergencyRescheduleHandler'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  const { error: authError } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const supabase = createAdminClient()
    const settings = await getEmergencySettings(supabase)
    return NextResponse.json(settings)
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

const UpdateSchema = z.object({
  emergency_helpdesk_phone: z.string().max(30).optional(),
  emergency_reschedule_message_template: z.string().max(2000).optional(),
  emergency_decline_response_template: z.string().max(2000).optional(),
  emergency_cancel_message_template: z.string().max(2000).optional(),
})

export async function PUT(request: NextRequest) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const updates = parsed.data

    const keys = Object.keys(updates) as (keyof typeof updates)[]
    for (const key of keys) {
      const value = updates[key]
      if (value === undefined) continue
      await supabase
        .from('system_settings')
        .update({ value: JSON.stringify(value), updated_by: user!.id, updated_at: new Date().toISOString() })
        .eq('key', key)
    }

    return NextResponse.json({ success: true, message: 'Emergency settings updated.' })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
