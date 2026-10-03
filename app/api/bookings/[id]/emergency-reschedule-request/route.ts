import { NextRequest, NextResponse } from 'next/server'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import {
  createRescheduleRequest,
  withdrawRescheduleRequest,
} from '@/backend/booking/emergencyRescheduleRequestService'
import { getErrorMessage } from '@/lib/errors'

const CreateSchema = z.object({
  reason: z.string().min(10, 'Please provide a detailed reason (at least 10 characters)').max(2000),
  attachment_url: z.string().url().optional(),
  proposed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  proposed_start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  proposed_end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
})

// POST — submit a new emergency reschedule request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
  }

  try {
    const { id: __rawId } = await params
  const __idParsed = parseUuidParam(__rawId, 'booking id')
  if (!__idParsed.ok) return __idParsed.response
  const id = __idParsed.value
    const result = await createRescheduleRequest({
      bookingId: id,
      userId: user!.id,
      reason: parsed.data.reason,
      attachmentUrl: parsed.data.attachment_url ?? null,
      proposedDate: parsed.data.proposed_date,
      proposedStartTime: parsed.data.proposed_start_time,
      proposedEndTime: parsed.data.proposed_end_time,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      requestId: result.requestId,
      extraAmountCentavos: result.extraAmountCentavos ?? 0,
    })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

// DELETE — withdraw the pending reschedule request for this booking
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const { id: bookingId } = await params
    const supabase = createAdminClient()

    const { data: req, error } = await supabase
      .from('emergency_reschedule_requests')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('user_id', user!.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (error || !req) {
      return NextResponse.json({ error: 'No pending reschedule request found for this booking' }, { status: 404 })
    }

    const result = await withdrawRescheduleRequest((req as any).id, user!.id)
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 422 })
    }

    return NextResponse.json({ success: true, message: result.message })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
