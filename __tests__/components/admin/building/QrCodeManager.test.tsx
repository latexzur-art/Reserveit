import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { QrCodeManager } from '@/components/admin/building/payment-management/QrCodeManager'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
    if (url.includes('payment-qr-codes') && (!opts || opts.method === undefined)) {
      return Promise.resolve({ ok: true, json: async () => ({ qrCodes: [{ id: 'qc-1', label: 'GCash', image_url: 'https://x/gcash.png', is_active: true, display_order: 0, category: 'gcash', created_at: new Date().toISOString() }] }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
  }) as any
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

describe('QrCodeManager', () => {
  it('renders existing QR codes with an active toggle', async () => {
    render(<QrCodeManager />)
    await waitFor(() => expect(screen.getAllByText('GCash').length).toBeGreaterThanOrEqual(1))
  })

  it('rejects an oversized file before uploading', async () => {
    render(<QrCodeManager />)
    await waitFor(() => screen.getAllByText('GCash'))
    const input = screen.getByLabelText(/add qr code/i).querySelector('input[type="file"]') as HTMLInputElement
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [bigFile] } })
    await waitFor(() => expect(screen.getByText(/5MB/i)).toBeInTheDocument())
  })

  it('has an accessible label for the QR code name input', async () => {
    render(<QrCodeManager />)
    await waitFor(() => screen.getAllByText('GCash'))
    const qrNameInput = screen.getByLabelText(/qr code name/i)
    expect(qrNameInput).toHaveAttribute('id', 'qr-label')
    expect(qrNameInput).toHaveAttribute('placeholder', 'e.g. GCash, Maya, BPI Transfer')
  })

  it('shows an error toast when toggling the active state fails', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('payment-qr-codes') && (!opts || opts.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => ({ qrCodes: [{ id: 'qc-1', label: 'GCash', image_url: 'https://x/gcash.png', is_active: true, display_order: 0, category: 'gcash' }] }) })
      }
      if (opts?.method === 'PATCH') {
        return Promise.resolve({ ok: false, json: async () => ({ error: 'Failed to update QR code' }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
    }) as any

    render(<QrCodeManager />)
    await waitFor(() => screen.getAllByText('GCash'))
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to update QR code'))
  })

  it('shows an error toast when renaming a QR code fails', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('payment-qr-codes') && (!opts || opts.method === undefined)) {
        return Promise.resolve({ ok: true, json: async () => ({ qrCodes: [{ id: 'qc-1', label: 'GCash', image_url: 'https://x/gcash.png', is_active: true, display_order: 0, category: 'gcash' }] }) })
      }
      if (opts?.method === 'PATCH') {
        return Promise.resolve({ ok: false, json: async () => ({ error: 'Failed to rename QR code' }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
    }) as any

    render(<QrCodeManager />)
    await waitFor(() => screen.getAllByText('GCash'))
    const renameInput = screen.getByLabelText(/rename/i)
    fireEvent.change(renameInput, { target: { value: 'GCash Updated' } })
    fireEvent.blur(renameInput)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to rename QR code'))
  })

  it('shows an error toast when reordering QR codes fails', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('payment-qr-codes') && (!opts || opts.method === undefined)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            qrCodes: [
              { id: 'qc-1', label: 'GCash', image_url: 'https://x/gcash.png', is_active: true, display_order: 0, category: 'gcash' },
              { id: 'qc-2', label: 'Maya', image_url: 'https://x/maya.png', is_active: true, display_order: 1, category: 'maya' },
            ],
          }),
        })
      }
      if (opts?.method === 'PATCH') {
        return Promise.resolve({ ok: false, json: async () => ({ error: 'Failed to reorder' }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
    }) as any

    render(<QrCodeManager />)
    await waitFor(() => screen.getAllByText('GCash'))
    fireEvent.click(screen.getByRole('button', { name: /move gcash down/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to reorder QR codes'))
  })
})
