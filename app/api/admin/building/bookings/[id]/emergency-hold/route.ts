import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { putBookingOnHold } from '@/backend/booking/emergencyRescheduleHandler'
import { getErrorMessage } from '@/lib/errors'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  try {
    const { id } = await params
    const supabase = createAdminClient()
    const result = await putBookingOnHold(supabase, {
      bookingId: id,
      adminUserId: user!.id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 422 })
    }

    return NextResponse.json({ success: true, message: result.message })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
