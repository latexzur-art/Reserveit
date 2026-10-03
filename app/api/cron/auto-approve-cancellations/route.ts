import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendNotification, sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'

const TIMEOUT_HOURS = 24

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  try {
    const cutoff = new Date(Date.now() - TIMEOUT_HOURS * 60 * 60 * 1000).toISOString()

    // Find pending requests older than 24 hours
    const { data: expiredRequests, error: fetchError } = await supabase
      .from('cancellation_requests')
      .select('id, booking_id, user_id, reason, original_status, refund_window_met, bookings(booking_reference)')
      .eq('status', 'pending')
      .lt('created_at', cutoff)

    if (fetchError) {
      console.error('[cron/auto-approve-cancellations] Fetch error:', fetchError.message)
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
    }

    if (!expiredRequests || expiredRequests.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    let processed = 0
    let failed = 0

    for (const req of expiredRequests) {
      try {
        // Mark request as auto-approved
        await supabase
          .from('cancellation_requests')
          .update({
            status: 'auto_approved',
            auto_approved: true,
            reviewed_at: new Date().toISOString(),
            review_notes: `Auto-approved after ${TIMEOUT_HOURS} hours with no response from Academic Head.`,
          })
          .eq('id', req.id)

        // Cancel the booking
        await supabase.rpc('update_booking_status', {
          p_booking_id: req.booking_id,
          p_new_status: 'cancelled',
          p_changed_by_user_id: null,
          p_changed_by_ai: true,
          p_reason: `Cancellation auto-approved after ${TIMEOUT_HOURS} hours. Reason: ${req.reason}`,
          p_metadata: { cancellation_request_id: req.id, auto_approved: true, strike_waived: true },
        })

        // Stamp cancellation type (no strike)
        await supabase
          .from('bookings')
          .update({ cancellation_type: 'cancellation_approved', backend_cancellation_reason: req.reason })
          .eq('id', req.booking_id)

        // Payment-overhaul hook: refund-eligible paid booking → mark refund owed, notify Building Admin.
        // Note: 'refund_requested' is a forward-referenced payment_status enum value landing in a later
        // task in this plan (Task 10, Phase 1). This code is written against that future contract on purpose.
        if (req.refund_window_met) {
          const { data: payment, error: paymentLookupError } = await supabase
            .from('payments')
            .select('id, payment_status')
            .eq('booking_id', req.booking_id)
            .eq('payment_status', 'completed')
            .single()

          if (paymentLookupError) {
            console.error(`[cron/auto-approve-cancellations] Payment lookup error for request ${req.id}:`, paymentLookupError.message)
          }

          if (payment) {
            await supabase
              .from('payments')
              .update({ payment_status: 'refund_requested', updated_at: new Date().toISOString() })
              .eq('id', payment.id)

            await sendNotificationToRoles(supabase, ['building_admin'], {
              title: 'Refund Owed — Cancellation Auto-Approved',
              message: 'A 24h-timeout auto-approved cancellation is refund-eligible. Please process it in Payment Management.',
              type: 'warning',
              source_type: 'cancellation_request',
              source_id: req.id,
              priority: 'high',
            })
          }
        }

        // Notify user
        const bookingRef = (req.bookings as any)?.booking_reference ?? 'N/A'
        await sendNotification(supabase, {
          user_id: req.user_id,
          title: 'Cancellation Auto-Approved',
          message: `Your cancellation request for booking ${bookingRef} has been automatically approved after ${TIMEOUT_HOURS} hours. No strike was applied.`,
          type: 'success',
          source_type: 'cancellation_request',
          source_id: req.id,
          priority: 'normal',
        })

        processed++
      } catch (err) {
        console.error(`[cron/auto-approve-cancellations] Failed for request ${req.id}:`, err)
        failed++
      }
    }

    console.log(`[cron/auto-approve-cancellations] Processed: ${processed}, Failed: ${failed}`)
    return NextResponse.json({ processed, failed })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/auto-approve-cancellations] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
