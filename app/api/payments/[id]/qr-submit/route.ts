import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { QrSubmissionService } from '@/backend/payments/qrSubmissionService'
import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { checkRateLimitAsync, RATE_LIMITS } from '@/lib/rate-limit'
import { getBuildingAdminEmails } from '@/backend/notifications/recipientResolver'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { buildingAdminQrProofSubmittedEmail } from '@/backend/notifications/emailTemplates'

const BodySchema = z.object({
  qr_code_id: z.string().uuid(),
  payer_name: z.string().min(1),
  payer_contact_number: z.string().min(1),
  reference_number: z.string().min(1),
  screenshot_url: z.string().url().optional(),
  payer_account_name: z.string().optional(),
  payer_account_number: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError, user } = await requireAuthenticatedUser()
  if (authError) return authError

  const rateLimited = await checkRateLimitAsync(`qr-submit:${user.id}`, RATE_LIMITS.QR_SUBMIT)
  if (rateLimited) return apiError(429, 'Too many submissions — please wait before trying again')

  const { id: rawId } = await params
  const idCheck = parseUuidParam(rawId, 'payment id')
  if (!idCheck.ok) return idCheck.response
  const paymentId = idCheck.value

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return apiError(400, parsed.error.issues.map(i => i.message).join('; '))

  const supabase = createAdminClient()
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('user_id, booking:bookings!payments_booking_id_fkey(booking_reference)')
    .eq('id', paymentId)
    .single()
  if (paymentError || !payment) return apiError(404, 'Payment not found')
  if (payment.user_id !== user.id) return apiError(403, 'Forbidden')

  try {
    await QrSubmissionService.submit({
      paymentId,
      qrCodeId: parsed.data.qr_code_id,
      payerName: parsed.data.payer_name,
      payerContactNumber: parsed.data.payer_contact_number,
      referenceNumber: parsed.data.reference_number,
      screenshotUrl: parsed.data.screenshot_url,
      payerAccountName: parsed.data.payer_account_name,
      payerAccountNumber: parsed.data.payer_account_number,
    })
  } catch (err) {
    const message = getErrorMessage(err)
    if (message === 'invalid_status') return apiError(400, 'This payment can no longer accept proof submissions')
    if (message === 'qr_code_removed') return apiError(400, 'That payment method was removed — please pick another')
    return apiError(500, message)
  }

  // The submission itself already committed above — a failure here must never look
  // like the submission failed, so it's logged, not thrown.
  try {
    await sendNotificationToRoles(supabase, ['building_admin'], {
      title: 'QR Payment Proof Submitted',
      message: `${user.full_name ?? user.email} submitted payment proof (ref: ${parsed.data.reference_number}) for review.`,
      type: 'info', source_type: 'payment', source_id: paymentId, priority: 'normal',
    })

    const bookingRef = (payment as any).booking?.booking_reference ?? paymentId
    const adminEmails = await getBuildingAdminEmails()
    if (adminEmails.length > 0) {
      const { subject, htmlBody } = buildingAdminQrProofSubmittedEmail({
        bookingRef,
        payerName: parsed.data.payer_name,
        referenceNumber: parsed.data.reference_number,
      })
      await sendBrevoEmail({ to: adminEmails, subject, htmlBody }).catch(err =>
        console.error('[qr-submit] Failed to email building admins:', err)
      )
    }
  } catch (err) {
    console.error('[qr-submit] post-submit notification/email failed:', err)
  }

  return NextResponse.json({ success: true })
}
