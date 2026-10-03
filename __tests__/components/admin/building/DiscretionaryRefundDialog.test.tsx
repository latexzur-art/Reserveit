import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DiscretionaryRefundDialog } from '@/components/admin/building/payment-management/DiscretionaryRefundDialog'

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }) as any

describe('DiscretionaryRefundDialog', () => {
  it('disables submit until justification, destination, and amount are all filled', async () => {
    render(<DiscretionaryRefundDialog paymentId="p-1" totalAmount={500} onSuccess={() => {}} trigger={<button>Refund</button>} />)
    fireEvent.click(screen.getByText('Refund'))
    expect(screen.getByText('Submit Refund')).toBeDisabled()
  })

  it('marks required fields with a visual required-field indicator, matching RequestCancellationDialog', async () => {
    render(<DiscretionaryRefundDialog paymentId="p-1" totalAmount={500} onSuccess={() => {}} trigger={<button>Refund</button>} />)
    fireEvent.click(screen.getByText('Refund'))

    for (const label of [
      screen.getByText(/justification/i),
      screen.getByText(/^destination name/i),
      screen.getByText(/^destination contact number/i),
      screen.getByText(/outgoing transaction reference number/i),
    ]) {
      expect(label).toHaveTextContent('*')
    }
  })
})
