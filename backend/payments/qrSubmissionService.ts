import { createAdminClient } from '@/lib/supabase/server'

const SUBMITTABLE_STATUSES = ['pending', 'pending_review', 'failed']

export interface QrSubmitInput {
  paymentId: string
  qrCodeId: string
  payerName: string
  payerContactNumber: string
  referenceNumber: string
  screenshotUrl?: string
  payerAccountName?: string
  payerAccountNumber?: string
}

export const QrSubmissionService = {
  async submit(input: QrSubmitInput): Promise<void> {
    const supabase = createAdminClient()

    const { data: payment, error: paymentError } = await supabase
      .from('payments').select('id, payment_status').eq('id', input.paymentId).single()
    if (paymentError || !payment) throw new Error('payment_not_found')
    if (!SUBMITTABLE_STATUSES.includes(payment.payment_status)) throw new Error('invalid_status')

    const { data: qrCode, error: qrCodeError } = await supabase
      .from('payment_qr_codes').select('id').eq('id', input.qrCodeId).single()
    if (qrCodeError || !qrCode) throw new Error('qr_code_removed')

    const { error: insertError } = await supabase.from('payment_qr_submissions').insert({
      payment_id: input.paymentId,
      qr_code_id: input.qrCodeId,
      payer_name: input.payerName,
      payer_contact_number: input.payerContactNumber,
      reference_number: input.referenceNumber,
      screenshot_url: input.screenshotUrl ?? null,
      payer_account_name: input.payerAccountName ?? null,
      payer_account_number: input.payerAccountNumber ?? null,
    })
    if (insertError) throw new Error(insertError.message)

    const { error: updateError } = await supabase.from('payments').update({
      qr_code_id: input.qrCodeId,
      qr_reference_number: input.referenceNumber,
      qr_payer_name: input.payerName,
      qr_payer_contact_number: input.payerContactNumber,
      qr_screenshot_url: input.screenshotUrl ?? null,
      qr_payer_account_name: input.payerAccountName ?? null,
      qr_payer_account_number: input.payerAccountNumber ?? null,
      qr_submitted_at: new Date().toISOString(),
      payment_status: 'pending_review',
      updated_at: new Date().toISOString(),
    }).eq('id', input.paymentId)
    if (updateError) throw new Error(updateError.message)
  },
}
