import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PaymentManagementPage from '@/app/admin/(building)/building/payment-management/page'

const mockTransactions = [
  {
    id: 'pay-1',
    paymentReference: 'PAY-1',
    bookingId: 'b-1',
    bookingReference: 'BK-1',
    userId: 'u-1',
    userName: 'Jane Doe',
    amount: 750,
    currency: 'PHP',
    paymentMethod: 'qr',
    paymentStatus: 'completed',
    facilityName: 'Gym',
    bookingDate: '2026-08-01',
    createdAt: '2026-08-01T00:00:00Z',
    expiresAt: null,
    qrReferenceNumber: null,
    qrPayerName: null,
    qrScreenshotUrl: null,
  },
  {
    id: 'pay-2',
    paymentReference: 'PAY-2',
    bookingId: 'b-2',
    bookingReference: 'BK-2',
    userId: 'u-2',
    userName: 'John Roe',
    amount: 400,
    currency: 'PHP',
    paymentMethod: 'qr',
    paymentStatus: 'pending',
    facilityName: 'Hall',
    bookingDate: '2026-08-02',
    createdAt: '2026-08-02T00:00:00Z',
    expiresAt: null,
    qrReferenceNumber: null,
    qrPayerName: null,
    qrScreenshotUrl: null,
  },
]

function mockFetchImpl(url: string) {
  if (url.includes('payment-policy')) {
    return Promise.resolve({ ok: true, json: async () => ({ payment_method_mode: 'paymongo', payment_helpdesk_contact: '' }) })
  }
  if (url.includes('needs-review')) {
    return Promise.resolve({ ok: true, json: async () => ({ payments: [] }) })
  }
  if (url.includes('payment-qr-codes')) {
    return Promise.resolve({ ok: true, json: async () => ({ qrCodes: [] }) })
  }
  if (url.includes('logs/payments')) {
    return Promise.resolve({ ok: true, json: async () => ({ transactions: mockTransactions, total: 2, totalRefunded: 1500 }) })
  }
  return Promise.resolve({ ok: true, json: async () => ({}) })
}

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation(mockFetchImpl) as any
})

describe('PaymentManagementPage', () => {
  it('renders the page heading and tab triggers', async () => {
    render(<PaymentManagementPage />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: /payment management/i })).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: /transactions/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /needs review/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /audit/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /settings/i })).toBeInTheDocument()
  })

  it('shows revenue stats in the Transactions tab', async () => {
    render(<PaymentManagementPage />)
    await waitFor(() => expect(screen.getByText(/total revenue/i)).toBeInTheDocument())
    // 750 completed = ₱750 — appears in both stats card and table
    expect(screen.getAllByText('₱750').length).toBeGreaterThanOrEqual(1)
  })

  it('renders every transaction in the Transactions table', async () => {
    render(<PaymentManagementPage />)
    await waitFor(() => expect(screen.getByText('BK-1')).toBeInTheDocument())
    expect(screen.getByText('BK-2')).toBeInTheDocument()
  })

  it('shows the Transactions tab as active by default', async () => {
    render(<PaymentManagementPage />)
    await waitFor(() => expect(screen.getByText(/total revenue/i)).toBeInTheDocument())
    const transactionsTab = screen.getByRole('tab', { name: /transactions/i })
    expect(transactionsTab).toHaveAttribute('data-state', 'active')
  })

  it('shows empty state message when no payments exist', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('logs/payments')) {
        return Promise.resolve({ ok: true, json: async () => ({ transactions: [], total: 0, totalRefunded: 0 }) })
      }
      return mockFetchImpl(url)
    }) as any
    render(<PaymentManagementPage />)
    await waitFor(() => expect(screen.getByText(/no transactions found/i)).toBeInTheDocument())
  })
})
