import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ExtendBookingModal } from '@/components/bookings/ExtendBookingModal'

// Mock formatTime to return a predictable string
vi.mock('@/lib/formatTime', () => ({
  formatTime: (t: string) => t,
}))

const defaultProps = {
  bookingId: 'booking-123',
  bookingReference: 'BK-2026-001',
  currentEndTime: '15:00:00',
  bookingDate: '2026-08-14',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
}

const facilityRatesResponse = {
  facilityId: 'fac-abc',
  facilityName: 'Gymnasium A',
  amRate: 600,
  pmRate: 900,
  amCutoffHour: 17,
  addons: [
    { id: 'addon-1', name: 'Basic Sound System', amount: 2000 },
    { id: 'addon-2', name: 'LED Lights', amount: 3000 },
  ],
  rawRates: [],
}

describe('ExtendBookingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: global fetch returns 404 (no rates configured)
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(null, { status: 404 })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the modal with booking reference and current end time', () => {
    render(<ExtendBookingModal {...defaultProps} />)
    expect(screen.getByText('BK-2026-001')).toBeDefined()
    expect(screen.getByText('15:00')).toBeDefined()
    expect(screen.getByText('Extend Booking')).toBeDefined()
  })

  it('fetches facility rates when facilityId is provided', async () => {
    vi.mocked(global.fetch).mockImplementation(async (url: any) => {
      if (url.includes('/api/facilities/fac-abc/rates')) {
        return new Response(JSON.stringify(facilityRatesResponse), { status: 200 })
      }
      return new Response(null, { status: 404 })
    })

    render(<ExtendBookingModal {...defaultProps} facilityId="fac-abc" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/facilities/fac-abc/rates')
    })
  })

  it('does not fetch rates when facilityId is null', () => {
    render(<ExtendBookingModal {...defaultProps} facilityId={null} />)

    // fetch should only be called for the extend API (if at all), not for rates
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/facilities/')
    )
  })

  it('does not fetch rates when facilityId is undefined', () => {
    render(<ExtendBookingModal {...defaultProps} />)

    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/facilities/')
    )
  })

  it('uses facility-specific rates in cost preview when available', async () => {
    vi.mocked(global.fetch).mockImplementation(async (url: any) => {
      if (url.includes('/api/facilities/fac-abc/rates')) {
        return new Response(JSON.stringify(facilityRatesResponse), { status: 200 })
      }
      return new Response(null, { status: 404 })
    })

    render(<ExtendBookingModal {...defaultProps} facilityId="fac-abc" />)

    // Wait for rates to be fetched
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/facilities/fac-abc/rates')
    })

    // Select a new end time (16:00 — 1 hour extension, all in AM window since cutoff is 17)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '16:00' } })

    // Cost preview should appear with facility rate (₱600/hr AM rate, not default ₱580)
    await waitFor(() => {
      expect(screen.getByText('Estimated Extension Cost')).toBeDefined()
    })

    // The total should be 1 hour × ₱600 = ₱600.00 (facility AM rate), NOT ₱580 (default)
    // Note: ₱600.00 appears in both the line item subtotal and the total
    const amounts = screen.getAllByText('₱600.00')
    expect(amounts.length).toBeGreaterThanOrEqual(2)

    // ₱580 (default) should NOT appear anywhere
    expect(screen.queryByText('₱580.00')).toBeNull()

    // The rate display text should show facility rates
    // Text is split across elements: "₱600.00" + "/hr (before " + "17" + ":00 PM)"
    const rateInfoEl = screen.getByText(/AM rate:/)
    expect(rateInfoEl.textContent).toContain('₱600.00')
    expect(rateInfoEl.textContent).toContain('/hr')
    expect(rateInfoEl.textContent).toContain('₱900.00')
  })

  it('falls back to hardcoded rates when no facilityId is provided', async () => {
    render(<ExtendBookingModal {...defaultProps} />)

    // Select a new end time (16:00 — 1 hour extension, all in AM window with default cutoff at 17)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '16:00' } })

    // Cost preview should appear with default rate (₱580/hr AM rate)
    await waitFor(() => {
      expect(screen.getByText('Estimated Extension Cost')).toBeDefined()
    })

    // The total should be 1 hour × ₱580 = ₱580.00 (default AM rate)
    // Appears in both line item and total
    const amounts = screen.getAllByText('₱580.00')
    expect(amounts.length).toBeGreaterThanOrEqual(2)

    // The rate display text should show default rates
    // Text is split across elements: "₱580.00" + "/hr (before " + "5" + ":00 PM)"
    const rateInfoEl = screen.getByText(/AM rate:/)
    expect(rateInfoEl.textContent).toContain('₱580.00')
    expect(rateInfoEl.textContent).toContain('/hr')
    expect(rateInfoEl.textContent).toContain('₱780.00')
  })

  it('falls back to hardcoded rates when facility rates fetch fails', async () => {
    vi.mocked(global.fetch).mockImplementation(async (url: any) => {
      if (url.includes('/api/facilities/fac-abc/rates')) {
        return new Response(null, { status: 500 })
      }
      return new Response(null, { status: 404 })
    })

    render(<ExtendBookingModal {...defaultProps} facilityId="fac-abc" />)

    // Wait for the failed fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/facilities/fac-abc/rates')
    })

    // Select a new end time
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '16:00' } })

    // Should fall back to default rates (₱580/hr)
    await waitFor(() => {
      const amounts = screen.getAllByText('₱580.00')
      expect(amounts.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows custom PM cutoff in rate display text', async () => {
    vi.mocked(global.fetch).mockImplementation(async (url: any) => {
      if (url.includes('/api/facilities/fac-abc/rates')) {
        return new Response(
          JSON.stringify({ ...facilityRatesResponse, amCutoffHour: 18 }),
          { status: 200 }
        )
      }
      return new Response(null, { status: 404 })
    })

    render(<ExtendBookingModal {...defaultProps} facilityId="fac-abc" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/facilities/fac-abc/rates')
    })

    // Select end time in the PM window (after cutoff=18, so 19:00 is PM)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '17:00' } })

    await waitFor(() => {
      expect(screen.getByText('Estimated Extension Cost')).toBeDefined()
    })

    // Rate display text is split across elements: "before " + "18" + ":00 PM"
    // Check the parent <p> contains the expected text
    const rateInfoEl = screen.getByText(/AM rate:/)
    expect(rateInfoEl.textContent).toContain('18')
    expect(rateInfoEl.textContent).toContain(':00 PM')
    expect(rateInfoEl.textContent).toContain('onwards')
  })

  it('submits extension request with correct payload', async () => {
    vi.mocked(global.fetch).mockImplementation(async (url: any, options?: any) => {
      if (url.includes('/api/bookings/booking-123/extend')) {
        return new Response(
          JSON.stringify({ extension_booking_reference: 'BK-2026-EXT-001' }),
          { status: 201 }
        )
      }
      return new Response(null, { status: 404 })
    })

    render(<ExtendBookingModal {...defaultProps} />)

    // Select end time
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '16:00' } })

    // Click submit
    const submitBtn = screen.getByText('Request Extension')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/bookings/booking-123/extend',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ new_end_time: '16:00' }),
        })
      )
    })

    // Should show success state
    await waitFor(() => {
      expect(screen.getByText('Extension Request Submitted!')).toBeDefined()
      expect(screen.getByText('BK-2026-EXT-001')).toBeDefined()
    })
  })
})
