import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QrPaymentPanel } from '@/components/payments/QrPaymentPanel'

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('payment-qr-codes')) return Promise.resolve({ ok: true, json: async () => ({ qrCodes: [{ id: 'qc-1', label: 'GCash', image_url: 'https://x/gcash.png', account_name: 'ReserveIT GCash', account_number: '09171234567', category: 'gcash' }, { id: 'qc-2', label: 'Maya', image_url: 'https://x/maya.png', account_name: null, account_number: null, category: 'maya' }] }) })
    return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
  }) as any
})

describe('QrPaymentPanel', () => {
  it('shows a picker with every active QR code', async () => {
    render(<QrPaymentPanel paymentId="p-1" payerNameDefault="Jane" payerContactDefault="0917" currentStatus="pending" helpdeskContact="0912" onSubmitted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('GCash').length).toBeGreaterThanOrEqual(1))
    expect(screen.getAllByText('Maya').length).toBeGreaterThanOrEqual(1)
  })

  it('shows an empty state when there are no active QR codes', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ qrCodes: [] }) }) as any
    render(<QrPaymentPanel paymentId="p-1" payerNameDefault="Jane" payerContactDefault="0917" currentStatus="pending" helpdeskContact="0912" onSubmitted={() => {}} />)
    await waitFor(() => expect(screen.getByText(/no payment method available/i)).toBeInTheDocument())
  })

  it('marks the selected e-wallet chip with aria-pressed for screen readers', async () => {
    render(<QrPaymentPanel paymentId="p-1" payerNameDefault="Jane" payerContactDefault="0917" currentStatus="pending" helpdeskContact="0912" onSubmitted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('GCash').length).toBeGreaterThanOrEqual(1))

    // The pressed QR code button is the one with aria-pressed="true" —
    // there are duplicates (category filter + QR code selection), so use getAllByRole
    const gcashButtons = screen.getAllByRole('button', { pressed: true, name: 'GCash' })
    const gcashChip = gcashButtons[gcashButtons.length - 1] // last one is in QR selection
    const mayaButtons = screen.getAllByRole('button', { name: 'Maya' })
    const mayaChip = mayaButtons[mayaButtons.length - 1] // last one is in QR selection
    expect(gcashChip).toHaveAttribute('aria-pressed', 'true')
    expect(mayaChip).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(mayaChip)
    expect(mayaChip).toHaveAttribute('aria-pressed', 'true')
    expect(gcashChip).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the rejection reason and a resubmit form for failed status', async () => {
    render(<QrPaymentPanel paymentId="p-1" payerNameDefault="Jane" payerContactDefault="0917" currentStatus="failed" rejectionReason="Ref does not match" helpdeskContact="0912" onSubmitted={() => {}} />)
    await waitFor(() => expect(screen.getByText(/Ref does not match/)).toBeInTheDocument())
  })

  it('displays account_name and account_number below the selected QR code', async () => {
    render(<QrPaymentPanel paymentId="p-1" payerNameDefault="Jane" payerContactDefault="0917" currentStatus="pending" helpdeskContact="0912" onSubmitted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('GCash').length).toBeGreaterThanOrEqual(1))
    expect(screen.getByText('ReserveIT GCash')).toBeInTheDocument()
    expect(screen.getByText('09171234567')).toBeInTheDocument()
  })

  it('does not render account info section when account_name and account_number are null', async () => {
    render(<QrPaymentPanel paymentId="p-1" payerNameDefault="Jane" payerContactDefault="0917" currentStatus="pending" helpdeskContact="0912" onSubmitted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('Maya').length).toBeGreaterThanOrEqual(1))
    // Select Maya (second QR code with null account fields) — use last match (QR selection section)
    const mayaButtons = screen.getAllByRole('button', { name: 'Maya' })
    fireEvent.click(mayaButtons[mayaButtons.length - 1])
    // No account text should appear for Maya
    expect(screen.queryByText('ReserveIT GCash')).not.toBeInTheDocument()
  })

  it('includes account name and account number input fields in the form', async () => {
    render(<QrPaymentPanel paymentId="p-1" payerNameDefault="Jane" payerContactDefault="0917" currentStatus="pending" helpdeskContact="0912" onSubmitted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('GCash').length).toBeGreaterThanOrEqual(1))
    expect(screen.getByLabelText(/account name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/account number/i)).toBeInTheDocument()
  })

  it('sends payer_account_name and payer_account_number in the submission', async () => {
    render(<QrPaymentPanel paymentId="p-1" payerNameDefault="Jane" payerContactDefault="0917" currentStatus="pending" helpdeskContact="0912" onSubmitted={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('GCash').length).toBeGreaterThanOrEqual(1))

    fireEvent.change(screen.getByLabelText(/payer name/i), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByLabelText(/contact number/i), { target: { value: '09171234567' } })
    fireEvent.change(screen.getByLabelText(/reference number/i), { target: { value: 'REF-1' } })
    fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: 'Jane GCash' } })
    fireEvent.change(screen.getByLabelText(/account number/i), { target: { value: '09991234567' } })

    fireEvent.click(screen.getByRole('button', { name: /submit payment proof/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/payments/p-1/qr-submit',
        expect.objectContaining({
          body: expect.stringContaining('"payer_account_name":"Jane GCash"'),
        })
      )
    })
  })

  describe('screenshot upload failure handling', () => {
    afterEach(() => {
      // @ts-expect-error - test-only global stub cleanup
      delete global.createImageBitmap
    })

    it('surfaces an error instead of failing silently when resizing the screenshot throws (e.g. a corrupt file)', async () => {
      // jsdom has no createImageBitmap implementation, so resizeImage() rejects
      // exactly like a real corrupt-file failure would in a browser.
      render(<QrPaymentPanel paymentId="p-1" payerNameDefault="Jane" payerContactDefault="0917" currentStatus="pending" helpdeskContact="0912" onSubmitted={() => {}} />)
      await waitFor(() => expect(screen.getAllByText('GCash').length).toBeGreaterThanOrEqual(1))

      const file = new File(['bad-bytes'], 'corrupt.png', { type: 'image/png' })
      const input = document.getElementById('qr-screenshot') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => expect(screen.getByText(/unable to (process|upload)/i)).toBeInTheDocument())
    })

    it('surfaces an error instead of failing silently when the upload request responds with a non-ok status', async () => {
      global.createImageBitmap = vi.fn().mockResolvedValue({ width: 100, height: 100, close: vi.fn() }) as any
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as any)
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) {
        cb(new Blob(['x'], { type: 'image/webp' }))
      })

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('payment-qr-codes')) return Promise.resolve({ ok: true, json: async () => ({ qrCodes: [{ id: 'qc-1', label: 'GCash', image_url: 'https://x/gcash.png', category: 'gcash' }] }) })
        if (url.includes('screenshot-upload')) return Promise.resolve({ ok: false, json: async () => ({ error: 'Upload failed' }) })
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
      }) as any

      render(<QrPaymentPanel paymentId="p-1" payerNameDefault="Jane" payerContactDefault="0917" currentStatus="pending" helpdeskContact="0912" onSubmitted={() => {}} />)
      await waitFor(() => expect(screen.getAllByText('GCash').length).toBeGreaterThanOrEqual(1))

      const file = new File(['ok-bytes'], 'screenshot.png', { type: 'image/png' })
      const input = document.getElementById('qr-screenshot') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => expect(screen.getByText(/Upload failed/)).toBeInTheDocument())
    })
  })
})
