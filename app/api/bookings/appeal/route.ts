import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sendNotificationToRoles } from '@/backend/booking'

const AppealSchema = z.object({
  appeal_reason: z.string().min(10, 'Appeal reason must be at least 10 characters').max(1000),
})

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = AppealSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    // Verify user is restricted
    const { data: userRecord } = await supabase
      .from('users')
      .select('account_status, appeal_submitted_at')
      .eq('id', user.id)
      .single()

    if (!userRecord || userRecord.account_status !== 'restricted') {
      return NextResponse.json(
        { error: 'Appeals can only be submitted by restricted accounts' },
        { status: 400 }
      )
    }

    if (userRecord.appeal_submitted_at) {
      return NextResponse.json(
        { error: 'An appeal has already been submitted. Please wait for admin review.' },
        { status: 409 }
      )
    }

    // Update user appeal fields
    await supabase
      .from('users')
      .update({
        appeal_reason: parsed.data.appeal_reason,
        appeal_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    // Notify building admins
    await sendNotificationToRoles(supabase, ['building_admin', 'academic_head'], {
      title: 'Restriction Appeal Submitted',
      message: `A restricted user has submitted an appeal for account reinstatement. Reason: ${parsed.data.appeal_reason.slice(0, 100)}${parsed.data.appeal_reason.length > 100 ? '...' : ''}`,
      type: 'info',
      source_type: 'user',
      source_id: user.id,
      priority: 'high',
    })

    return NextResponse.json({
      success: true,
      message: 'Your appeal has been submitted. An administrator will review it shortly.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] POST /bookings/appeal error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
