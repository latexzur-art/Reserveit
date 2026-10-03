import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { RequestCancellationDialog } from '@/components/cancellation/RequestCancellationDialog'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('browser-image-compression', () => ({
  default: vi.fn().mockImplementation(file => Promise.resolve(file)),
}))

describe('RequestCancellationDialog', () => {
  beforeEach(() => {
    // Fix "now" so refund-window assertions (which compare bookingDate against
    // new Date()) are deterministic regardless of when the suite runs.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'))
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, request_id: 'cr-1' }),
    }) as unknown as typeof fetch
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not show refund-destination fields for an unpaid booking', () => {
    render(
      <RequestCancellationDialog
        bookingId="b-1"
        bookingDate="2026-08-20"
        hasCompletedPayment={false}
        onSuccess={() => {}}
        trigger={<button>Request Cancellation</button>}
      />,
    )
    fireEvent.click(screen.getByText('Request Cancellation'))
    expect(screen.queryByLabelText(/destination name/i)).not.toBeInTheDocument()
  })

  it('shows refund-destination fields only when hasCompletedPayment is true', () => {
    render(
      <RequestCancellationDialog
        bookingId="b-1"
        bookingDate="2026-08-20"
        hasCompletedPayment={true}
        defaultDestinationName="Jane Doe"
        defaultDestinationContact="09171234567"
        onSuccess={() => {}}
        trigger={<button>Request Cancellation</button>}
      />,
    )
    fireEvent.click(screen.getByText('Request Cancellation'))
    expect(screen.getByLabelText(/destination name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/destination contact/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/destination name/i)).toHaveValue('Jane Doe')
    expect(screen.getByLabelText(/destination contact/i)).toHaveValue('09171234567')
  })

  it('shows the full-refund-eligible copy when the window is met', () => {
    render(
      <RequestCancellationDialog
        bookingId="b-1"
        bookingDate="2026-08-25"
        hasCompletedPayment={true}
        defaultDestinationName="Jane Doe"
        defaultDestinationContact="09171234567"
        onSuccess={() => {}}
        trigger={<button>Request Cancellation</button>}
      />,
    )
    fireEvent.click(screen.getByText('Request Cancellation'))
    expect(screen.getByText(/full refund if approved/i)).toBeInTheDocument()
  })

  it('shows the outside-refund-window copy when the window is not met', () => {
    render(
      <RequestCancellationDialog
        bookingId="b-1"
        bookingDate="2026-08-13"
        hasCompletedPayment={true}
        defaultDestinationName="Jane Doe"
        defaultDestinationContact="09171234567"
        onSuccess={() => {}}
        trigger={<button>Request Cancellation</button>}
      />,
    )
    fireEvent.click(screen.getByText('Request Cancellation'))
    expect(screen.getByText(/outside the refund window/i)).toBeInTheDocument()
  })

  it('disables submit until the reason reaches 20 characters', () => {
    render(
      <RequestCancellationDialog
        bookingId="b-1"
        bookingDate="2026-08-20"
        hasCompletedPayment={false}
        onSuccess={() => {}}
        trigger={<button>Request Cancellation</button>}
      />,
    )
    fireEvent.click(screen.getByText('Request Cancellation'))
    const submitBtn = screen.getByRole('button', { name: /submit request/i })
    expect(submitBtn).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'too short' } })
    expect(submitBtn).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'Schedule conflict with another class booking.' },
    })
    expect(submitBtn).not.toBeDisabled()
  })

  it('disables submit for a paid booking until destination fields are filled', () => {
    render(
      <RequestCancellationDialog
        bookingId="b-1"
        bookingDate="2026-08-20"
        hasCompletedPayment={true}
        onSuccess={() => {}}
        trigger={<button>Request Cancellation</button>}
      />,
    )
    fireEvent.click(screen.getByText('Request Cancellation'))
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'Schedule conflict with another class booking.' },
    })
    const submitBtn = screen.getByRole('button', { name: /submit request/i })
    expect(submitBtn).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/destination name/i), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText(/destination contact/i), { target: { value: '09171234567' } })
    expect(submitBtn).not.toBeDisabled()
  })

  it('submits reason only for an unpaid booking, and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    render(
      <RequestCancellationDialog
        bookingId="b-1"
        bookingDate="2026-08-20"
        hasCompletedPayment={false}
        onSuccess={onSuccess}
        trigger={<button>Request Cancellation</button>}
      />,
    )
    fireEvent.click(screen.getByText('Request Cancellation'))
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'Schedule conflict with another class booking.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/bookings/b-1/request-cancellation',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Schedule conflict with another class booking.' }),
      }),
    )
  })

  it('submits destination fields for a paid booking', async () => {
    const onSuccess = vi.fn()
    render(
      <RequestCancellationDialog
        bookingId="b-1"
        bookingDate="2026-08-20"
        hasCompletedPayment={true}
        onSuccess={onSuccess}
        trigger={<button>Request Cancellation</button>}
      />,
    )
    fireEvent.click(screen.getByText('Request Cancellation'))
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'Schedule conflict with another class booking.' },
    })
    fireEvent.change(screen.getByLabelText(/destination name/i), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText(/destination contact/i), { target: { value: '09171234567' } })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toEqual({
      reason: 'Schedule conflict with another class booking.',
      refund_destination_name: 'Jane Doe',
      refund_destination_contact_number: '09171234567',
    })
  })

  it('shows a success toast after a successful submission', async () => {
    const onSuccess = vi.fn()
    render(
      <RequestCancellationDialog
        bookingId="b-1"
        bookingDate="2026-08-20"
        hasCompletedPayment={false}
        onSuccess={onSuccess}
        trigger={<button>Request Cancellation</button>}
      />,
    )
    fireEvent.click(screen.getByText('Request Cancellation'))
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'Schedule conflict with another class booking.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith(
      'Cancellation request submitted. The Academic Head will review it shortly.',
    )
  })

  it('shows an error message and does not call onSuccess when the request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'A cancellation request is already pending for this booking' }),
    }) as unknown as typeof fetch
    const onSuccess = vi.fn()
    render(
      <RequestCancellationDialog
        bookingId="b-1"
        bookingDate="2026-08-20"
        hasCompletedPayment={false}
        onSuccess={onSuccess}
        trigger={<button>Request Cancellation</button>}
      />,
    )
    fireEvent.click(screen.getByText('Request Cancellation'))
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'Schedule conflict with another class booking.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() =>
      expect(screen.getByText(/already pending for this booking/i)).toBeInTheDocument(),
    )
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('allows uploading a refund QR code reference and shows downsized scannable preview', async () => {
    const onSuccess = vi.fn()
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/uploaded-qr.png' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, request_id: 'cr-1' }),
      })

    render(
      <RequestCancellationDialog
        bookingId="b-1"
        bookingDate="2026-08-20"
        hasCompletedPayment={true}
        onSuccess={onSuccess}
        trigger={<button>Request Cancellation</button>}
      />,
    )
    fireEvent.click(screen.getByText('Request Cancellation'))

    expect(screen.getByText(/upload gcash \/ maya qr code/i)).toBeInTheDocument()

    const file = new File(['dummy content'], 'qr.png', { type: 'image/png' })
    const fileInput = screen.getByLabelText(/upload gcash \/ maya qr code/i)
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByText(/qr code attached/i)).toBeInTheDocument())
    expect(screen.getByAltText(/refund qr code preview/i)).toHaveAttribute('src', 'https://example.com/uploaded-qr.png')

    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'Schedule conflict with another class booking.' },
    })
    fireEvent.change(screen.getByLabelText(/destination name/i), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText(/destination contact/i), { target: { value: '09171234567' } })
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())

    const submitCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]
    const body = JSON.parse(submitCall[1].body)
    expect(body).toEqual({
      reason: 'Schedule conflict with another class booking.',
      refund_destination_name: 'Jane Doe',
      refund_destination_contact_number: '09171234567',
      refund_destination_qr_url: 'https://example.com/uploaded-qr.png',
    })
  })
})
