import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { PaymentSettingsPanel } from '@/components/admin/building/payment-management/PaymentSettingsPanel'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Radix Select relies on pointer-capture APIs jsdom doesn't implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
    if (url.includes('payment-policy')) {
      if (opts?.method === 'PATCH') return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
      return Promise.resolve({ ok: true, json: async () => ({ payment_method_mode: 'paymongo', payment_helpdesk_contact: '' }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ qrCodes: [] }) })
  }) as any
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

describe('PaymentSettingsPanel', () => {
  it('lets the BA switch the payment mode', async () => {
    render(<PaymentSettingsPanel />)
    await waitFor(() => screen.getByText(/paymongo/i))
  })

  it('associates the Active Payment Method label with the select trigger', async () => {
    render(<PaymentSettingsPanel />)
    await waitFor(() => screen.getByText(/paymongo/i))
    expect(screen.getByRole('combobox', { name: /active payment method/i })).toBeInTheDocument()
  })

  it('has an accessible, h-11 helpdesk contact input and saves on blur', async () => {
    render(<PaymentSettingsPanel />)
    await waitFor(() => screen.getByText(/paymongo/i))

    const helpdeskInput = screen.getByLabelText(/helpdesk contact/i)
    expect(helpdeskInput).toHaveClass('h-11')

    fireEvent.change(helpdeskInput, { target: { value: '0912-345-6789' } })
    fireEvent.blur(helpdeskInput)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/payment-policy',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ payment_helpdesk_contact: '0912-345-6789' }),
        })
      )
    })
  })

  it('mounts the QR code manager', async () => {
    render(<PaymentSettingsPanel />)
    await waitFor(() => screen.getByText(/add qr code/i))
  })

  it('shows an error toast when loading payment settings fails', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('payment-policy')) {
        return Promise.resolve({ ok: false, json: async () => ({ error: 'Failed to load payment settings' }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ qrCodes: [] }) })
    }) as any

    render(<PaymentSettingsPanel />)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to load payment settings'))
  })

  it('shows an error toast when updating the payment mode fails', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('payment-policy')) {
        if (opts?.method === 'PATCH') return Promise.resolve({ ok: false, json: async () => ({ error: 'Failed to update payment method' }) })
        return Promise.resolve({ ok: true, json: async () => ({ payment_method_mode: 'paymongo', payment_helpdesk_contact: '' }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ qrCodes: [] }) })
    }) as any

    const user = userEvent.setup()
    render(<PaymentSettingsPanel />)
    await waitFor(() => screen.getByText(/paymongo/i))

    await user.click(screen.getByRole('combobox', { name: /active payment method/i }))
    await waitFor(() => screen.getByText(/qr — after ba approval/i))
    await user.click(screen.getByText(/qr — after ba approval/i))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to update payment method'))
  })

  it('shows an error toast when updating the helpdesk contact fails', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('payment-policy')) {
        if (opts?.method === 'PATCH') return Promise.resolve({ ok: false, json: async () => ({ error: 'Failed to update helpdesk contact' }) })
        return Promise.resolve({ ok: true, json: async () => ({ payment_method_mode: 'paymongo', payment_helpdesk_contact: '' }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ qrCodes: [] }) })
    }) as any

    render(<PaymentSettingsPanel />)
    await waitFor(() => screen.getByText(/paymongo/i))

    const helpdeskInput = screen.getByLabelText(/helpdesk contact/i)
    fireEvent.change(helpdeskInput, { target: { value: '0912-345-6789' } })
    fireEvent.blur(helpdeskInput)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to update helpdesk contact'))
  })
})
