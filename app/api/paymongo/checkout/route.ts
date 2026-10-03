import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { PAYMONGO_BASE, paymongoAuthHeader } from '@/lib/paymongo/config'
import { creditService } from '@/backend/credits/creditService'
import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { voidScheduleConflictsForPaidBooking } from '@/backend/schedule-events/voidScheduleConflictsForPaidBooking'
import { getBuildingAdminEmails } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { buildingAdminPaymentCompletedEmail, bookerPaymentConfirmedEmail } from '@/backend/notifications/emailTemplates'


const ALLOWED_PAYMENT_METHODS = ['gcash', 'card', 'paymaya', 'grab_pay', 'dob']

function isSafePath(path: string): boolean {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.includes(':')
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const paymentId = String((body as any).paymentId || '')
  const rawReturnPath: string = (body as any).returnPath || '/faculty/payment'
  const returnPath = isSafePath(rawReturnPath) ? rawReturnPath : '/faculty/payment'
  const applyCreditCentavosRaw = (body as any).applyCreditCentavos
  const applyCreditCentavos =
    Number.isInteger(applyCreditCentavosRaw) && applyCreditCentavosRaw > 0
      ? (applyCreditCentavosRaw as number)
      : 0

  if (!paymentId) {
    return NextResponse.json({ error: 'paymentId is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, amount, currency, payment_status, user_id, payment_reference, description, metadata, booking_id, expires_at')
    .eq('id', paymentId)
    .single()

  if (paymentError || !payment) {
    return NextResponse.json({ error: 'Payment record not found' }, { status: 404 })
  }

  if (payment.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (payment.payment_status !== 'pending' && payment.payment_status !== 'failed') {
    return NextResponse.json(
      { error: 'Payment cannot be checked out in its current status' },
      { status: 400 }
    )
  }

  // ponytail: expired link can't be paid or credited; no cron/expired-status needed,
  // just refuse re-use at the point where payment is actually initiated.
  if (payment.expires_at && new Date(payment.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'This payment link has expired. Contact the building admin for a new one.' },
      { status: 410 },
    )
  }

  const amountInCentavos = Math.round(Number(payment.amount) * 100)
  if (amountInCentavos <= 0) {
    return NextResponse.json({ error: 'Payment amount invalid' }, { status: 400 })
  }

  // Validate credit amount
  if (applyCreditCentavos > amountInCentavos) {
    return NextResponse.json(
      { error: `Credit amount (${applyCreditCentavos}) cannot exceed payment amount (${amountInCentavos})` },
      { status: 400 }
    )
  }

  const netCentavos = amountInCentavos - applyCreditCentavos
  const itemName = payment.description ?? `Booking payment ${payment.payment_reference}`

  // ── Full-coverage path: skip PayMongo entirely ───────────────────────────
  if (applyCreditCentavos > 0 && netCentavos === 0) {
    try {
      await creditService.applyCreditToPayment({
        userId: user.id,
        paymentId,
        bookingId: (payment as any).booking_id,
        amountCentavos: applyCreditCentavos,
      })
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to apply credit' }, { status: 422 })
    }

    await supabase.rpc('complete_payment', {
      p_payment_id: paymentId,
      p_amount_centavos: 0,
      p_paymongo_data: {
        credit_only: true,
        credit_applied_centavos: applyCreditCentavos,
        data: {
          attributes: {
            billing: {
              name: user.full_name,
              email: user.email,
              phone: user.phone || null,
            },
            payments: [
              {
                attributes: {
                  source: {
                    type: 'session_credits'
                  }
                }
              }
            ]
          }
        }
      },
    })

    // Fetch booking details for status transition, notifications, emails, and schedule voiding
    try {
      const { data: paidPayment } = await supabase
        .from('payments')
        .select(`
          id, amount, currency,
          booking:bookings!payments_booking_id_fkey(
            id, booking_reference, booking_date, start_time, end_time, user_id,
            booking_facilities(facility_id, facility:facilities(name)),
            user:users!bookings_user_id_fkey(full_name, email, notification_email)
          )
        `)
        .eq('id', paymentId)
        .single()

      if (paidPayment?.booking) {
        const bk = paidPayment.booking as any

        const facilityEntry = bk.booking_facilities?.[0]
        const facilityName = facilityEntry?.facility?.name ?? 'facility'
        const facilityId = facilityEntry?.facility_id ?? null
        const userName = bk.user?.full_name ?? 'A user'
        const amountLabel = paidPayment.amount
          ? `₱${Number(paidPayment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
          : ''

        // Notify building admins of the successful credit payment
        await sendNotificationToRoles(supabase, ['building_admin'], {
          title: 'Payment Received',
          message: `${userName} completed payment${amountLabel ? ` (${amountLabel})` : ''} via Session Credits for booking ${bk.booking_reference} — ${facilityName} on ${bk.booking_date} (${bk.start_time?.slice(0, 5)} – ${bk.end_time?.slice(0, 5)}). The reservation is now confirmed.`,
          type: 'success',
          source_type: 'booking',
          source_id: bk.id,
          priority: 'normal',
        })

        // Email building admins
        const fmt = (t: string) => {
          const [hStr, mStr] = t.split(':')
          const h = parseInt(hStr, 10)
          return `${h % 12 || 12}:${mStr.padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
        }
        const dateLabel = bk.booking_date
          ? new Date(bk.booking_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
          : bk.booking_date

        const adminEmails = await getBuildingAdminEmails()
        if (adminEmails.length > 0) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
          const { subject, htmlBody } = buildingAdminPaymentCompletedEmail({
            bookingRef: bk.booking_reference,
            requesterName: userName,
            facilityName,
            bookingDate: dateLabel,
            startTime: bk.start_time ? fmt(bk.start_time.slice(0, 5)) : '',
            endTime: bk.end_time ? fmt(bk.end_time.slice(0, 5)) : '',
            amountPaid: `${amountLabel} (Session Credits)`,
            adminPanelUrl: `${appUrl}/admin/building/reservations`,
          })
          await sendBrevoEmail({ to: adminEmails, subject, htmlBody }).catch(err =>
            console.error('[checkout-credits] Failed to email building admins:', err)
          )
        }

        // Email booker confirmation
        const bookerEmail = bk.user?.notification_email ?? null
        if (!bookerEmail) {
          console.warn(`[checkout-credits] Booking ${bk.id} user has no notification_email set — payment email skipped`)
        } else {
          const { subject, htmlBody } = bookerPaymentConfirmedEmail({
            userName,
            bookingRef: bk.booking_reference,
            facilityName,
            bookingDate: dateLabel,
            startTime: bk.start_time ? fmt(bk.start_time.slice(0, 5)) : '',
            endTime: bk.end_time ? fmt(bk.end_time.slice(0, 5)) : '',
            amountPaid: `${amountLabel} (Session Credits)`,
          })
          await sendBrevoEmail({ to: bookerEmail, subject, htmlBody }).catch(err =>
            console.error('[checkout-credits] Failed to email booker:', err)
          )
        }

        // Booker in-app notification
        if (bk.user_id) {
          const { error: bookerNotifErr } = await supabase.from('notifications').insert({
            user_id: bk.user_id,
            title: 'Payment Confirmed',
            message: `Your payment${amountLabel ? ` of ${amountLabel}` : ''} for booking ${bk.booking_reference} has been received via Session Credits. Your reservation is now confirmed!`,
            type: 'success',
            source_type: 'booking',
            source_id: bk.id,
            priority: 'high',
            read: false,
          })
          if (bookerNotifErr) console.error('[checkout-credits] Failed to notify booker in-app:', bookerNotifErr)
        }

        // Void conflicts
        if (facilityId && bk.booking_date && bk.start_time && bk.end_time) {
          await voidScheduleConflictsForPaidBooking(
            supabase,
            facilityId,
            bk.booking_date,
            bk.start_time,
            bk.end_time,
            bk.booking_reference,
            bk.id,
          )
        }
      }
    } catch (bkErr) {
      console.error('[checkout-credits] Error triggering payment complete hooks:', bkErr)
    }

    // Resolve facility name for receipt email
    const { data: facilityInfo } = await supabase
      .from('booking_facilities')
      .select('facilities(name)')
      .eq('booking_id', (payment as any).booking_id)
      .limit(1)
      .maybeSingle()
    const facilityName = (facilityInfo?.facilities as { name?: string } | null)?.name ?? 'Facility'

    const { data: newBalance } = await supabase.rpc('get_user_credit_balance', { p_user_id: user.id })
    void creditService.sendCreditAppliedReceipt({
      userId: user.id,
      bookingRef: payment.payment_reference,
      facilityName,
      appliedCentavos: applyCreditCentavos,
      paidViaPMCentavos: 0,
      newBalance: Number(newBalance ?? 0),
    })

    return NextResponse.json({ checkoutUrl: null, sessionId: null, fullyCoveredByCredit: true })
  }

  // ── Standard path (no credit) or partial credit ─────────────────────────
  const origin = new URL(request.url).origin
  const successUrl = `${origin}${returnPath}?paymongo_result=success&paymentId=${paymentId}`
  const cancelUrl  = `${origin}${returnPath}?paymongo_result=failed&paymentId=${paymentId}`

  const creditNote = applyCreditCentavos > 0
    ? ` (₱${(applyCreditCentavos / 100).toFixed(2)} credit applied)`
    : ''

  const sessionPayload = {
    data: {
      attributes: {
        line_items: [
          {
            name: itemName + creditNote,
            amount: netCentavos,
            currency: payment.currency || 'PHP',
            quantity: 1,
          },
        ],
        payment_method_types: ALLOWED_PAYMENT_METHODS,
        success_url: successUrl,
        cancel_url: cancelUrl,
        reference_number: payment.payment_reference,
        description: itemName + creditNote,
      },
    },
  }

  const response = await fetch(`${PAYMONGO_BASE}/checkout_sessions`, {
    method: 'POST',
    headers: {
      Authorization: paymongoAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sessionPayload),
  })

  const responseJson = await response.json().catch(() => null)

  if (!response.ok) {
    const detail = responseJson?.errors?.[0]?.detail || responseJson?.message || 'PayMongo request failed'
    return NextResponse.json({ error: detail }, { status: response.status })
  }

  const sessionId   = responseJson?.data?.id
  const checkoutUrl = responseJson?.data?.attributes?.checkout_url

  if (!checkoutUrl || !sessionId) {
    return NextResponse.json({ error: 'PayMongo did not return a checkout URL' }, { status: 500 })
  }

  // PayMongo session created successfully — now deduct credit atomically
  if (applyCreditCentavos > 0) {
    try {
      await creditService.applyCreditToPayment({
        userId: user.id,
        paymentId,
        bookingId: (payment as any).booking_id,
        amountCentavos: applyCreditCentavos,
      })
    } catch (err: any) {
      // Credit deduction failed after PayMongo session was created — still let the user pay full amount
      console.error('[checkout] Credit apply failed after PayMongo session created:', err)
      // Return the full-price session; credit stays intact
      const nextStatus = payment.payment_status === 'failed' ? 'pending' : payment.payment_status
      await supabase
        .from('payments')
        .update({
          paymongo_checkout_session_id: sessionId,
          paymongo_checkout_url: checkoutUrl,
          payment_status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
      return NextResponse.json({
        checkoutUrl,
        sessionId,
        creditApplyError: 'Credit could not be applied. Full amount charged.',
      })
    }
  }

  const nextStatus = payment.payment_status === 'failed' ? 'pending' : payment.payment_status
  await supabase
    .from('payments')
    .update({
      paymongo_checkout_session_id: sessionId,
      paymongo_checkout_url: checkoutUrl,
      payment_status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)

  return NextResponse.json({
    checkoutUrl,
    sessionId,
    ...(applyCreditCentavos > 0 && { creditAppliedCentavos: applyCreditCentavos }),
  })
}
