import { describe, it, expect } from 'vitest'
import { generateRefundReceiptHtml } from '@/app/client/payment/_lib/refundReceipt'

describe('generateRefundReceiptHtml', () => {
  it('includes the refund amount, destination, and reference', () => {
    const html = generateRefundReceiptHtml(
      { id: 'p-1', payment_reference: 'PAY-1', amount: 500, currency: 'PHP', payment_method: 'qr_manual', payment_status: 'refunded', description: null, created_at: '2026-08-01', updated_at: '2026-08-12' } as any,
      { amount: 500, reference_number: 'REF-9', destination_name: 'Jane Doe', destination_contact_number: '0917', recorded_at: '2026-08-12T10:00:00Z', recorded_by_name: 'BA Admin', trigger_type: 'ba_override', justification_note: 'Phone arrangement' } as any,
    )
    expect(html).toContain('OFFICIAL REFUND RECEIPT')
    expect(html).toContain('REF-9')
    expect(html).toContain('Jane Doe')
    expect(html).toContain('Phone arrangement')
  })

  it('omits the justification note for entitlement refunds', () => {
    const html = generateRefundReceiptHtml(
      { id: 'p-1', payment_reference: 'PAY-1', amount: 500, currency: 'PHP', payment_method: 'qr_manual', payment_status: 'refunded', description: null, created_at: '2026-08-01', updated_at: '2026-08-12' } as any,
      { amount: 500, reference_number: 'REF-9', destination_name: 'Jane Doe', destination_contact_number: '0917', recorded_at: '2026-08-12T10:00:00Z', recorded_by_name: 'BA Admin', trigger_type: 'cancellation_request_entitlement' } as any,
    )
    expect(html).not.toContain('Justification')
  })
})
