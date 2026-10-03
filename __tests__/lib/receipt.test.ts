import { describe, it, expect } from 'vitest'
import { generateReceiptHtml, type PaymentRecord } from '@/app/client/payment/_lib/receipt'

const basePayment: PaymentRecord = {
  id: '1',
  payment_reference: 'PAY-20260801-001',
  amount: 1500,
  currency: 'PHP',
  payment_method: 'paymongo_gcash',
  payment_status: 'completed',
  description: null,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
  metadata: { facility_name: 'Gymnasium', booking_purpose: 'Event' },
  booking: {
    id: 'b1',
    booking_reference: 'BK-2026-001',
    booking_purpose: 'Event',
    purpose: 'Event',
    current_status: 'approved',
    organization_name: 'Test Org',
    contact_number: '09171234567',
    user: { full_name: 'Juan Dela Cruz', email: 'juan@test.com' },
  },
}

describe('generateReceiptHtml', () => {
  it('contains the payment reference', () => {
    const html = generateReceiptHtml(basePayment)
    expect(html).toContain('PAY-20260801-001')
  })

  it('contains the renter name', () => {
    const html = generateReceiptHtml(basePayment)
    expect(html).toContain('Juan Dela Cruz')
  })

  it('escapes HTML in user-entered name to prevent XSS', () => {
    const malicious: PaymentRecord = {
      ...basePayment,
      booking: {
        ...basePayment.booking!,
        user: { full_name: '<script>alert("xss")</script>', email: 'test@test.com' },
      },
    }
    const html = generateReceiptHtml(malicious)
    expect(html).not.toContain('<script>alert("xss")</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes HTML in organization name', () => {
    const malicious: PaymentRecord = {
      ...basePayment,
      booking: {
        ...basePayment.booking!,
        organization_name: '<img src=x onerror=alert(1)>',
      },
    }
    const html = generateReceiptHtml(malicious)
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
    expect(html).toContain('&lt;img')
  })

  it('escapes HTML in contact number', () => {
    const malicious: PaymentRecord = {
      ...basePayment,
      booking: {
        ...basePayment.booking!,
        contact_number: '"><script>alert(1)</script>',
      },
    }
    const html = generateReceiptHtml(malicious)
    expect(html).not.toContain('"><script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes HTML in QR payer name', () => {
    const malicious: PaymentRecord = {
      ...basePayment,
      payment_method: 'qr_manual',
      qr_payer_name: '<b>bold</b>',
    }
    const html = generateReceiptHtml(malicious)
    expect(html).not.toContain('<b>bold</b>')
    expect(html).toContain('&lt;b&gt;')
  })

  it('handles null/undefined booking fields gracefully', () => {
    const minimal: PaymentRecord = {
      ...basePayment,
      booking: {
        id: 'b1',
        booking_reference: 'BK-001',
        booking_purpose: 'Event',
        purpose: 'Event',
        current_status: 'approved',
      },
    }
    expect(() => generateReceiptHtml(minimal)).not.toThrow()
  })
})
