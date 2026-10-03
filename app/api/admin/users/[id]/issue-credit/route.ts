import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { creditService } from '@/backend/credits/creditService'
import { getErrorMessage } from '@/lib/errors'
import { apiError } from '@/lib/api/response'
import { parseUuidParam } from '@/lib/api/validate-uuid'

const Schema = z.object({
  amount_centavos: z.number().int().positive(),
  reason: z.string().min(5).max(1000),
  source: z.enum(['force_majeure', 'admin_manual']).default('force_majeure'),
  source_booking_id: z.string().uuid().optional(),
  cancel_booking: z.boolean().optional(),
  expires_at: z.string().datetime().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Issued from both the user-manager table and the building-admin booking
  // drawer — either role may issue credits.
  const { user, error: authError } = await getAuthUserWithRoles()
  if (!user) return apiError(401, authError ?? 'Unauthorized')
  const roleNames = user.roles?.map((r: { name: string }) => r.name) || []
  if (!roleNames.includes('building_admin') && !roleNames.includes('it_admin')) {
    return apiError(403, 'Forbidden: building_admin or it_admin role required')
  }

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

  const { id: rawId } = await params
  const idParsed = parseUuidParam(rawId, 'user id')
  if (!idParsed.ok) return idParsed.response
  const targetUserId = idParsed.value
  const { amount_centavos, reason, source, source_booking_id, cancel_booking, expires_at } = parsed.data

  const supabase = createAdminClient()

  // Verify target user exists
  const { data: targetUser, error: userError } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('id', targetUserId)
    .single()

  if (userError || !targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    // Optionally cancel the linked booking first
    if (cancel_booking && source_booking_id) {
      const { error: cancelError } = await supabase.rpc('update_booking_status', {
        p_booking_id: source_booking_id,
        p_new_status: 'cancelled',
        p_changed_by_user_id: user!.id,
        p_changed_by_ai: false,
        p_reason: reason,
        p_metadata: { source: 'admin_credit_issuance' },
      })
      if (cancelError) {
        return NextResponse.json({ error: `Failed to cancel booking: ${cancelError.message}` }, { status: 422 })
      }
      await supabase
        .from('bookings')
        .update({ cancellation_type: 'force_majeure', cancelled_at: new Date().toISOString() })
        .eq('id', source_booking_id)
    }

    const { creditId, newBalance } = await creditService.issueCredit({
      userId: targetUserId,
      amountCentavos: amount_centavos,
      source,
      sourceBookingId: source_booking_id ?? null,
      issuedBy: user!.id,
      reason,
      expiresAt: expires_at ?? null,
      sendNotifications: true,
    })

    return NextResponse.json({
      success: true,
      creditId,
      newBalanceCentavos: newBalance,
      newBalancePeso: (newBalance / 100).toFixed(2),
    })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
