import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { createAdminClient } from '@/lib/supabase/server'
import { AdminAuditService } from '@/backend/admin/admin-audit.service'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'
import { getErrorMessage } from '@/lib/errors'

const BodySchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  receipt_number: z.string().optional(),
  notes: z.string().optional(),
})

/** Bookings in these statuses can receive a cash payment */
const PAYABLE_STATUSES = ['approved', 'auto_approved', 'pending_user_response']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireBuildingAdminStrict()
  if (authError) return authError

  const { id: rawId } = await params
  const idCheck = parseUuidParam(rawId, 'booking id')
  if (!idCheck.ok) return idCheck.response

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map(i => i.message).join('; ') },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  try {
    // 1. Validate booking exists and is in a payable status
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, current_status, user_id, booking_reference')
      .eq('id', idCheck.value)
      .single()

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (!PAYABLE_STATUSES.includes(booking.current_status)) {
      return NextResponse.json(
        { error: `Cannot record payment for booking in "${booking.current_status}" status` },
        { status: 409 },
      )
    }

    // 2. Insert payment record — cashier method, completed immediately
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .insert({
        booking_id: idCheck.value,
        user_id: booking.user_id,
        amount: parsed.data.amount,
        currency: 'PHP',
        payment_method: 'cashier',
        payment_status: 'completed',
        payment_type: 'booking',
        description: 'Cash payment recorded by Building Admin',
        metadata: {
          receipt_number: parsed.data.receipt_number ?? null,
          notes: parsed.data.notes ?? null,
        },
      })
      .select()
      .single()

    if (payErr) throw new Error(payErr.message)

    // 3. Log to audit trail
    await AdminAuditService.log({
      actorId: user!.id,
      action: 'cash_payment_recorded',
      targetType: 'booking',
      targetId: idCheck.value,
      details: {
        payment_id: payment.id,
        amount: parsed.data.amount,
        receipt_number: parsed.data.receipt_number ?? null,
      },
    })

    // 4. Notify user
    await sendNotification(supabase, {
      user_id: booking.user_id,
      title: 'Cash Payment Received',
      message: `A cash payment of ₱${parsed.data.amount.toFixed(2)} has been recorded for your booking ${booking.booking_reference}.`,
      type: 'success',
      source_type: 'booking',
      source_id: idCheck.value,
      priority: 'high',
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
