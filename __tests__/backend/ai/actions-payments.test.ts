import { describe, it, expect } from 'vitest'
import { ACTIONS, getActionMeta, resolveActionFacts } from '@/backend/ai/actions'

describe('Payment write-actions', () => {
  it('verify_qr_payment is normal risk, building_admin only', () => {
    expect(ACTIONS.verify_qr_payment.allowedRoles).toEqual(['building_admin'])
    expect(getActionMeta('verify_qr_payment').risk).toBe('normal')
  })

  it('reject_qr_payment requires a reason', () => {
    expect(ACTIONS.reject_qr_payment.required).toContain('reason')
  })

  it('confirm_entitlement_refund is high risk with a type-to-confirm phrase', () => {
    expect(getActionMeta('confirm_entitlement_refund').risk).toBe('high')
    expect(getActionMeta('confirm_entitlement_refund').confirmPhrase).toBe('REFUND')
  })

  it('override_refund requires justification_note, destination_name, destination_contact_number, amount', () => {
    expect(ACTIONS.override_refund.required).toEqual(
      expect.arrayContaining(['payment_id', 'amount', 'justification_note', 'destination_name', 'destination_contact_number']),
    )
    expect(getActionMeta('override_refund').confirmPhrase).toBe('OVERRIDE REFUND')
  })

  it('override_refund and confirm_entitlement_refund use DISTINCT confirm phrases', () => {
    expect(getActionMeta('override_refund').confirmPhrase).not.toBe(
      getActionMeta('confirm_entitlement_refund').confirmPhrase,
    )
  })

  it('verify_qr_payment request() proxies to the qr-verify endpoint with an empty body', () => {
    const req = ACTIONS.verify_qr_payment.request({ payment_id: 'p-1' })
    expect(req.method).toBe('POST')
    expect(req.path).toBe('/api/admin/building/payments/p-1/qr-verify')
    expect(req.body).toEqual({})
  })

  it('reject_qr_payment request() proxies to the qr-reject endpoint with the reason', () => {
    const req = ACTIONS.reject_qr_payment.request({ payment_id: 'p-1', reason: 'blurry proof' })
    expect(req.method).toBe('POST')
    expect(req.path).toBe('/api/admin/building/payments/p-1/qr-reject')
    expect(req.body).toEqual({ reason: 'blurry proof' })
  })

  it('confirm_entitlement_refund request() proxies to the refunds endpoint with the entitlement trigger', () => {
    const req = ACTIONS.confirm_entitlement_refund.request({
      payment_id: 'p-1', cancellation_request_id: 'cr-1', reference_number: 'REF-1',
    })
    expect(req.method).toBe('POST')
    expect(req.path).toBe('/api/admin/building/payments/p-1/refunds')
    expect(req.body).toMatchObject({
      trigger_type: 'cancellation_request_entitlement',
      cancellation_request_id: 'cr-1',
      reference_number: 'REF-1',
    })
    // No amount is sent on the entitlement path (server derives it).
    expect(req.body).not.toHaveProperty('amount')
  })

  it('override_refund request() proxies to the refunds endpoint with trigger_type ba_override', () => {
    const req = ACTIONS.override_refund.request({
      payment_id: 'p-1', amount: 500, justification_note: 'phone arrangement',
      destination_name: 'Jane', destination_contact_number: '0917', reference_number: 'REF-1',
    })
    expect(req.path).toBe('/api/admin/building/payments/p-1/refunds')
    expect(req.body).toMatchObject({
      trigger_type: 'ba_override',
      amount: 500,
      justification_note: 'phone arrangement',
      destination_name: 'Jane',
      destination_contact_number: '0917',
    })
  })

  it('override_refund coerces a string amount to a number for the zod .positive() schema', () => {
    const req = ACTIONS.override_refund.request({
      payment_id: 'p-1', amount: '500', justification_note: 'x',
      destination_name: 'Jane', destination_contact_number: '0917',
    })
    expect(req.body?.amount).toBe(500)
    expect(typeof req.body?.amount).toBe('number')
  })
})

describe('resolveActionFacts — payment actions re-fetch SERVER truth', () => {
  const paymentPayload = {
    payment: {
      id: 'p-uuid',
      payment_reference: 'PAY-REAL',
      amount: 1500,
      payment_status: 'pending_review',
      qr_payer_name: 'Server Payer',
      qr_reference_number: 'QR-REAL',
      booking: { booking_reference: 'BK-REAL' },
    },
  }

  function fakeFetch(payload: unknown, ok = true, status = 200) {
    return async () => ({ ok, status, json: async () => payload })
  }

  it('re-fetches the payment and reports SERVER facts, ignoring the model-supplied reference', async () => {
    const facts = await resolveActionFacts(
      'verify_qr_payment',
      { payment_id: 'p-uuid', payment_reference: 'PAY-FAKE', qr_payer_name: 'Model Liar' },
      { cookie: null, origin: 'http://x', fetchImpl: fakeFetch(paymentPayload) },
    )
    expect(facts).not.toBeNull()
    const flat = JSON.stringify(facts)
    expect(flat).toContain('PAY-REAL')
    expect(flat).not.toContain('PAY-FAKE')
    expect(flat).toContain('Server Payer')
    expect(flat).not.toContain('Model Liar')
    expect(flat).toContain('BK-REAL')
    expect(flat).toContain('QR-REAL')
    expect(flat).toContain('pending_review')
  })

  it('degrades to params when the payment fetch fails — never crashes the confirm card', async () => {
    const facts = await resolveActionFacts(
      'override_refund',
      { payment_id: 'p-uuid', payment_reference: 'PAY-FALLBACK' },
      { cookie: null, origin: 'http://x', fetchImpl: fakeFetch({ error: 'nope' }, false, 404) },
    )
    // Fetch failed → fetchPaymentFacts returns null → resolveActionFacts falls back to paramFacts.
    // paramFacts has no payment_id or payment_reference key, so it returns null here.
    // The fallback prevents crashes while gracefully returning null when no param-facts keys match.
    expect(facts).toBeNull()
  })
})

describe('set_payment_mode — institution-wide toggle', () => {
  it('set_payment_mode is high risk regardless of blast-radius auto-escalation', () => {
    expect(getActionMeta('set_payment_mode').risk).toBe('high')
  })

  it('set_payment_mode validates the mode value', () => {
    const err = ACTIONS.set_payment_mode.validate?.({ mode: 'bitcoin' })
    expect(err).toBeTruthy()
  })

  it('set_payment_mode is building_admin only', () => {
    expect(ACTIONS.set_payment_mode.allowedRoles).toEqual(['building_admin'])
  })

  it('set_payment_mode requires a type-to-confirm phrase distinct from other high-risk payment actions', () => {
    expect(getActionMeta('set_payment_mode').confirmPhrase).toBe('SWITCH PAYMENT METHOD')
  })

  it('set_payment_mode request() proxies to PATCH /api/settings/payment-policy', () => {
    const req = ACTIONS.set_payment_mode.request({ mode: 'qr_after_approval' })
    expect(req.method).toBe('PATCH')
    expect(req.path).toBe('/api/settings/payment-policy')
    expect(req.body).toEqual({ payment_method_mode: 'qr_after_approval' })
  })

  it('set_payment_mode accepts each valid mode', () => {
    for (const mode of ['paymongo', 'qr_after_approval', 'qr_at_submission']) {
      expect(ACTIONS.set_payment_mode.validate?.({ mode })).toBeNull()
    }
  })
})
