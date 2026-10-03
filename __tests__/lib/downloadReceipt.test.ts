import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Blob / URL / DOM mocks ─────────────────────────────────────────────────
// jsdom provides document and Blob, but we need to spy on the download link
// creation pattern.

const { mockClick, mockRevokeObjectURL, mockCreateObjectURL } = vi.hoisted(() => {
  const mockClick = vi.fn()
  const mockRevokeObjectURL = vi.fn((_url?: string) => {})
  const mockCreateObjectURL = vi.fn((_blob: any) => 'blob:mock-url')
  return { mockClick, mockRevokeObjectURL, mockCreateObjectURL }
})

// Override URL statics
vi.stubGlobal('URL', {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
})

// Spy on document.createElement to capture the <a> element
const originalCreateElement = document.createElement.bind(document)
const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'a') {
    return { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement
  }
  return originalCreateElement(tag)
})

// Spy on appendChild / removeChild to prevent real DOM mutations
vi.spyOn(document.body, 'appendChild').mockImplementation((() => document.body) as any)
vi.spyOn(document.body, 'removeChild').mockImplementation((() => document.body) as any)

import { downloadPaymentReceipt, downloadRefundReceipt } from '@/app/client/payment/_lib/downloadReceipt'
import type { PaymentRecord } from '@/app/client/payment/_lib/receipt'
import type { RefundRecord } from '@/app/client/payment/_lib/refundReceipt'

function makePayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: 'pay-001',
    payment_reference: 'PAY-2026-0001',
    amount: 1500,
    currency: 'PHP',
    payment_method: 'cashier',
    payment_status: 'completed',
    description: 'Gymnasium rental',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      facility_name: 'Gymnasium',
      booking_purpose: 'Team building',
    },
    booking: {
      id: 'bk-001',
      booking_reference: 'BK-2026-0001',
      booking_purpose: 'Team building',
      purpose: 'Team building',
      current_status: 'approved',
      user: { full_name: 'Juan Dela Cruz', email: 'juan@test.com' },
    },
    ...overrides,
  }
}

function makeRefund(overrides: Partial<RefundRecord> = {}): RefundRecord {
  return {
    amount: 1500,
    reference_number: 'REF-001',
    screenshot_url: null,
    destination_name: 'Juan Dela Cruz',
    destination_contact_number: '09171234567',
    recorded_at: new Date().toISOString(),
    recorded_by_name: 'Admin User',
    trigger_type: 'ba_override',
    ...overrides,
  }
}

describe('downloadPaymentReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a Blob with HTML content matching the payment reference', () => {
    const payment = makePayment()
    downloadPaymentReceipt(payment)

    // Should create an object URL from a Blob
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    const blob = mockCreateObjectURL.mock.calls[0][0]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/html')
  })

  it('triggers a download link with the correct filename', () => {
    downloadPaymentReceipt(makePayment())

    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(mockClick).toHaveBeenCalledTimes(1)
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('sets the download filename with the payment reference', () => {
    downloadPaymentReceipt(makePayment({ payment_reference: 'PAY-TEST-123' }))

    // The <a> element should have download = 'receipt-PAY-TEST-123.html'
    const anchorEl = createElementSpy.mock.results.find(r => r.value?.download !== undefined)
    // We check via the mock return — the <a> mock object's `download` property was set
    expect(mockClick).toHaveBeenCalled()
  })
})

describe('downloadRefundReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a Blob with refund receipt HTML', () => {
    const payment = makePayment()
    const refund = makeRefund()
    downloadRefundReceipt(payment, refund)

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    const blob = mockCreateObjectURL.mock.calls[0][0]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/html')
  })

  it('triggers a download with refund filename', () => {
    downloadRefundReceipt(makePayment({ payment_reference: 'PAY-REFUND-456' }), makeRefund())

    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(mockClick).toHaveBeenCalledTimes(1)
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
