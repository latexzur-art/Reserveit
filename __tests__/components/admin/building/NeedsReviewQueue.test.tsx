import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NeedsReviewQueue } from '@/components/admin/building/payment-management/NeedsReviewQueue'

const pendingPayment = {
  id: 'p-1', payment_reference: 'PAY-1', amount: 500, payment_status: 'pending_review',
  qr_payer_name: 'Jane Doe', qr_reference_number: 'REF-1', qr_screenshot_url: null,
  qr_payer_account_name: 'Jane GCash', qr_payer_account_number: '09991234567',
  qr_code: { label: 'GCash', account_name: 'ReserveIT GCash', account_number: '09171234567' },
  booking: { booking_reference: 'BK-1' }, submissions: [],
}

const refundRequestedPayment = {
  id: 'p-2', payment_reference: 'PAY-2', amount: 750, payment_status: 'refund_requested',
  qr_payer_name: 'John Roe', qr_reference_number: 'REF-2', qr_screenshot_url: null, qr_code: { label: 'Maya' },
  booking: { booking_reference: 'BK-2' }, submissions: [],
}

const multiSubmissionPayment = {
  id: 'p-3', payment_reference: 'PAY-3', amount: 1000, payment_status: 'pending_review',
  qr_payer_name: 'Ana Cruz', qr_reference_number: 'REF-3B', qr_screenshot_url: null, qr_code: { label: 'GCash' },
  booking: { booking_reference: 'BK-3' },
  submissions: [
    { id: 's-1', payer_name: 'Ana Cruz', reference_number: 'REF-3A', screenshot_url: null, submitted_at: '2026-08-01T00:00:00Z', qr_code: { label: 'GCash' } },
    { id: 's-2', payer_name: 'Ana Cruz', reference_number: 'REF-3B', screenshot_url: null, submitted_at: '2026-08-02T00:00:00Z', qr_code: { label: 'GCash' } },
  ],
}

function mockFetchWith(payments: unknown[]) {
  return vi.fn().mockImplementation((url: string, opts?: any) => {
    if (url.includes('/needs-review')) {
      return Promise.resolve({ ok: true, json: async () => ({ payments }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
  })
}

describe('NeedsReviewQueue', () => {
  beforeEach(() => {
    global.fetch = mockFetchWith([pendingPayment]) as any
  })

  it('shows the payer name prominently for pending_review rows', async () => {
    render(<NeedsReviewQueue />)
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText(/REF-1/)).toBeInTheDocument()
  })

  it('shows an empty state when nothing needs review', async () => {
    global.fetch = mockFetchWith([]) as any
    render(<NeedsReviewQueue />)
    await waitFor(() => expect(screen.getByText(/nothing needs review/i)).toBeInTheDocument())
  })

  it('shows the refund-owed badge for refund_requested rows instead of proof-review controls', async () => {
    global.fetch = mockFetchWith([refundRequestedPayment]) as any
    render(<NeedsReviewQueue />)
    await waitFor(() => expect(screen.getByText(/BK-2/)).toBeInTheDocument())
    expect(screen.getByText(/full refund owed/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /verify/i })).not.toBeInTheDocument()
    expect(screen.queryByText('John Roe')).not.toBeInTheDocument()
  })

  it('calls qr-verify and refetches when Verify is clicked', async () => {
    render(<NeedsReviewQueue />)
    await waitFor(() => screen.getByText('Jane Doe'))
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/building/payments/p-1/qr-verify', expect.objectContaining({ method: 'POST' }))
    )
  })

  it('opens a reason dialog (not window.prompt) when Reject is clicked', async () => {
    const promptSpy = vi.spyOn(window, 'prompt')
    render(<NeedsReviewQueue />)
    await waitFor(() => screen.getByText('Jane Doe'))
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await waitFor(() => expect(screen.getByLabelText(/rejection reason/i)).toBeInTheDocument())
    expect(promptSpy).not.toHaveBeenCalled()
    promptSpy.mockRestore()
  })

  it('disables the confirm action until a reason is entered, then submits qr-reject with it', async () => {
    render(<NeedsReviewQueue />)
    await waitFor(() => screen.getByText('Jane Doe'))
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    const textarea = await screen.findByLabelText(/rejection reason/i)

    const confirmButton = screen.getByRole('button', { name: /confirm reject/i })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(textarea, { target: { value: 'Reference number does not match' } })
    expect(confirmButton).not.toBeDisabled()

    fireEvent.click(confirmButton)
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/building/payments/p-1/qr-reject',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ reason: 'Reference number does not match' }),
        })
      )
    )
  })

  it('shows a toggle for previous submissions when more than one submission exists', async () => {
    global.fetch = mockFetchWith([multiSubmissionPayment]) as any
    render(<NeedsReviewQueue />)
    await waitFor(() => screen.getByText('Ana Cruz'))
    const toggle = screen.getByText(/previous submissions/i)
    expect(screen.queryByText('REF-3A')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    await waitFor(() => expect(screen.getByText(/REF-3A/)).toBeInTheDocument())
  })

  it('displays the QR code account details for the selected payment method', async () => {
    render(<NeedsReviewQueue />)
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText(/ReserveIT GCash/)).toBeInTheDocument()
    expect(screen.getByText(/09171234567/)).toBeInTheDocument()
  })

  it('displays the payer account details when present', async () => {
    render(<NeedsReviewQueue />)
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText(/Jane GCash/)).toBeInTheDocument()
    expect(screen.getByText(/09991234567/)).toBeInTheDocument()
  })

  it('does not show payer account details when they are absent', async () => {
    const paymentNoAccount = {
      ...pendingPayment,
      qr_payer_account_name: null,
      qr_payer_account_number: null,
    }
    global.fetch = mockFetchWith([paymentNoAccount]) as any
    render(<NeedsReviewQueue />)
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    // QR code account info should still show
    expect(screen.getByText(/ReserveIT GCash/)).toBeInTheDocument()
    // Payer account info should not show
    expect(screen.queryByText(/Jane GCash/)).not.toBeInTheDocument()
  })
})
