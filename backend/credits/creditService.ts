import { createAdminClient } from '@/lib/supabase/server'
import { NotificationService } from '@/backend/notifications/notification.service'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import {
  sessionCreditIssuedEmail,
  sessionCreditAppliedEmail,
} from '@/backend/notifications/emailTemplates'

export type CreditSource = 'force_majeure' | 'alternative_declined' | 'admin_manual' | 'checkout_application'

export interface IssueCreditInput {
  userId: string
  amountCentavos: number
  source: Exclude<CreditSource, 'checkout_application'>
  sourceBookingId?: string | null
  issuedBy: string
  reason: string
  expiresAt?: string | null
  sendNotifications?: boolean
}

export interface ApplyCreditInput {
  userId: string
  paymentId: string
  bookingId: string
  amountCentavos: number
}

export interface CreditEntry {
  id: string
  amount_centavos: number
  event_type: string
  source: string
  reason: string | null
  source_booking_id: string | null
  applied_to_booking_id: string | null
  expires_at: string | null
  created_at: string
}

export interface IssueCreditResult {
  creditId: string
  newBalance: number
}

export interface ApplyCreditResult {
  ledgerId: string
  remainingCentavos: number
  newBalance: number
}

export const creditService = {
  async issueCredit(input: IssueCreditInput): Promise<IssueCreditResult> {
    const {
      userId, amountCentavos, source, sourceBookingId,
      issuedBy, reason, expiresAt, sendNotifications = true,
    } = input

    if (amountCentavos <= 0) {
      throw new Error(`Issue amount must be positive (got ${amountCentavos})`)
    }

    const supabase = createAdminClient()

    const { data: creditId, error } = await supabase.rpc('issue_session_credit', {
      p_user_id: userId,
      p_amount_centavos: amountCentavos,
      p_source: source,
      p_source_booking_id: sourceBookingId ?? null,
      p_issued_by: issuedBy,
      p_reason: reason,
      p_expires_at: expiresAt ?? null,
    })

    if (error) throw new Error(`Failed to issue credit: ${error.message}`)

    const { data: balance } = await supabase.rpc('get_user_credit_balance', { p_user_id: userId })
    const newBalance = Number(balance ?? amountCentavos)
    const amountPeso = (amountCentavos / 100).toFixed(2)
    const balancePeso = (newBalance / 100).toFixed(2)

    if (sendNotifications) {
      void NotificationService.create({
        user_id: userId,
        title: 'Session Credit Issued',
        message: `₱${amountPeso} session credit has been added to your account. Your new balance is ₱${balancePeso}.`,
        type: 'success',
        source_type: 'session_credit',
        source_id: creditId,
        priority: 'high',
        action_url: '/client/credits',
        metadata: { amount_centavos: amountCentavos, reason, source },
      }).catch(err => console.error('[creditService.issueCredit] notification failed:', err))

      void (async () => {
        const { data: user } = await supabase
          .from('users')
          .select('email, full_name, notification_email')
          .eq('id', userId)
          .single()
        const emailTo = (user as any)?.notification_email ?? null
        if (!emailTo) {
          console.warn(`[creditService.issueCredit] User ${userId} has no notification_email set — credit email skipped`)
        } else {
          const template = sessionCreditIssuedEmail({
            userName: (user as any)?.full_name ?? 'Valued User',
            amountPeso,
            reason,
            newBalancePeso: balancePeso,
            applyUrl: '/client/payment',
          })
          await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
            .catch(err => console.error('[creditService.issueCredit] email failed:', err))
        }
      })()
    }

    return { creditId, newBalance }
  },

  async applyCreditToPayment(input: ApplyCreditInput): Promise<ApplyCreditResult> {
    const { userId, paymentId, bookingId, amountCentavos } = input

    if (amountCentavos <= 0) {
      throw new Error(`Apply amount must be positive (got ${amountCentavos})`)
    }

    const supabase = createAdminClient()

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, booking_id, payment_status, amount')
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      throw new Error('Payment not found')
    }

    const paymentCentavos = Math.round(Number((payment as any).amount) * 100)
    if (amountCentavos > paymentCentavos) {
      throw new Error(`Credit amount (${amountCentavos}) exceeds payment amount (${paymentCentavos})`)
    }

    const { data: ledgerId, error } = await supabase.rpc('apply_credit_to_payment', {
      p_user_id: userId,
      p_amount_centavos: amountCentavos,
      p_payment_id: paymentId,
      p_booking_id: bookingId,
    })

    if (error) throw new Error(`Failed to apply credit: ${error.message}`)

    const remainingCentavos = paymentCentavos - amountCentavos
    const { data: balance } = await supabase.rpc('get_user_credit_balance', { p_user_id: userId })
    const newBalance = Number(balance ?? 0)

    return { ledgerId, remainingCentavos, newBalance }
  },

  async getUserBalance(userId: string): Promise<number> {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('get_user_credit_balance', { p_user_id: userId })
    if (error) throw new Error(`Failed to get balance: ${error.message}`)
    return Number(data ?? 0)
  },

  async getCreditHistory(
    userId: string,
    opts: { limit?: number; offset?: number } = {}
  ): Promise<{ entries: CreditEntry[]; total: number; balanceCentavos: number }> {
    const supabase = createAdminClient()
    const limit = opts.limit ?? 50
    const offset = opts.offset ?? 0

    const { data, count, error } = await supabase
      .from('session_credits')
      .select('id, amount_centavos, event_type, source, reason, source_booking_id, applied_to_booking_id, expires_at, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new Error(`Failed to get credit history: ${error.message}`)

    const { data: balance } = await supabase.rpc('get_user_credit_balance', { p_user_id: userId })

    return {
      entries: (data as CreditEntry[]) ?? [],
      total: count ?? 0,
      balanceCentavos: Number(balance ?? 0),
    }
  },

  async sendCreditAppliedReceipt(opts: {
    userId: string
    bookingRef: string
    facilityName: string
    appliedCentavos: number
    paidViaPMCentavos: number
    newBalance: number
  }) {
    const { userId, bookingRef, facilityName, appliedCentavos, paidViaPMCentavos, newBalance } = opts
    const supabase = createAdminClient()
    const { data: user } = await supabase
      .from('users')
      .select('email, full_name, notification_email')
      .eq('id', userId)
      .single()

    const emailTo = (user as any)?.notification_email ?? null
    if (!emailTo) {
      console.warn(`[creditService.sendCreditAppliedReceipt] User ${userId} has no notification_email set — receipt email skipped`)
      return
    }

    const template = sessionCreditAppliedEmail({
      userName: (user as any)?.full_name ?? 'Valued User',
      bookingRef,
      facilityName,
      appliedPeso: (appliedCentavos / 100).toFixed(2),
      paidViaPaymongoPeso: (paidViaPMCentavos / 100).toFixed(2),
      remainingBalancePeso: (newBalance / 100).toFixed(2),
      receiptDate: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
    })

    await sendBrevoEmail({ to: emailTo, subject: template.subject, htmlBody: template.htmlBody })
      .catch(err => console.error('[creditService.sendCreditAppliedReceipt] email failed:', err))
  },
}
