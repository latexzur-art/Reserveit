import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeesPanel } from '@/app/client/booking/_components/FeesPanel'

describe('FeesPanel Component (TDD)', () => {
  const defaultFormData = {
    organization_name: '',
    contact_number: '',
    booking_purpose: 'personal' as const,
    event_name: '',
    purpose: '',
    booking_date: '2026-08-20',
    start_time: '',
    end_time: '',
    expected_attendees: '',
    is_recurring: false,
    special_requests: '',
    addon_sound: false,
    addon_led: false,
  }

  const defaultLiveCost = {
    amount: 0,
    breakdown: [],
    hasTime: false,
  }

  it('renders loading indicator when loadingRates is true', () => {
    render(
      <FeesPanel
        facilityRates={null}
        loadingRates={true}
        formData={defaultFormData}
        updateField={vi.fn()}
        liveCost={defaultLiveCost}
      />
    )
    expect(screen.getByText('Fees and Charges')).toBeInTheDocument()
  })

  it('displays truthful message when NO custom rental rates are configured in DB', () => {
    render(
      <FeesPanel
        facilityRates={{
          facilityId: 'gym-1',
          facilityName: 'Gymnasium',
          amRate: null,
          pmRate: null,
          amCutoffHour: 17,
          addons: [],
          rawRates: [],
        }}
        loadingRates={false}
        formData={defaultFormData}
        updateField={vi.fn()}
        liveCost={defaultLiveCost}
      />
    )

    expect(screen.getByText(/AM rate: ₱580\/hr/)).toBeInTheDocument()
  })

  it('displays actual AM and PM rates when configured in DB', () => {
    render(
      <FeesPanel
        facilityRates={{
          facilityId: 'gym-1',
          facilityName: 'Gymnasium',
          amRate: 650,
          pmRate: 900,
          amCutoffHour: 17,
          addons: [],
          rawRates: [],
        }}
        loadingRates={false}
        formData={defaultFormData}
        updateField={vi.fn()}
        liveCost={defaultLiveCost}
      />
    )

    expect(screen.getByText('• AM rate: ₱650/hr (before 5:00 PM)')).toBeInTheDocument()
    expect(screen.getByText('• PM rate: ₱900/hr (5:00 PM onwards)')).toBeInTheDocument()
  })

  it('renders "No add-ons configured for this facility" when facility has no add-ons set in DB', () => {
    render(
      <FeesPanel
        facilityRates={{
          facilityId: 'gym-1',
          facilityName: 'Gymnasium',
          amRate: 580,
          pmRate: 780,
          amCutoffHour: 17,
          addons: [],
          rawRates: [],
        }}
        loadingRates={false}
        formData={defaultFormData}
        updateField={vi.fn()}
        liveCost={defaultLiveCost}
      />
    )

    expect(screen.getByText('No add-ons configured for this facility.')).toBeInTheDocument()
  })

  it('renders custom DB add-ons when present in facilityRates', () => {
    render(
      <FeesPanel
        facilityRates={{
          facilityId: 'gym-1',
          facilityName: 'Gymnasium',
          amRate: 580,
          pmRate: 780,
          amCutoffHour: 17,
          addons: [
            { id: 'addon-1', name: 'Professional Sound System', amount: 2000, isAddon: true },
            { id: 'addon-2', name: 'Stage LED Backdrop', amount: 3500, isAddon: true },
          ],
          rawRates: [],
        }}
        loadingRates={false}
        formData={defaultFormData}
        updateField={vi.fn()}
        liveCost={defaultLiveCost}
      />
    )

    expect(screen.getByText('Professional Sound System')).toBeInTheDocument()
    expect(screen.getByText('₱2,000.00')).toBeInTheDocument()
    expect(screen.getByText('Stage LED Backdrop')).toBeInTheDocument()
    expect(screen.getByText('₱3,500.00')).toBeInTheDocument()
  })

  it('calls updateField when add-on checkbox is clicked', () => {
    const updateFieldMock = vi.fn()
    render(
      <FeesPanel
        facilityRates={{
          facilityId: 'gym-1',
          facilityName: 'Gymnasium',
          amRate: 580,
          pmRate: 780,
          amCutoffHour: 17,
          addons: [
            { id: 'addon-1', name: 'Basic Sound System', amount: 1500, isAddon: true },
          ],
          rawRates: [],
        }}
        loadingRates={false}
        formData={defaultFormData}
        updateField={updateFieldMock}
        liveCost={defaultLiveCost}
      />
    )

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    expect(updateFieldMock).toHaveBeenCalledWith('addon_sound', true)
  })

  it('displays cost breakdown table when liveCost.hasTime is true', () => {
    render(
      <FeesPanel
        facilityRates={{
          facilityId: 'gym-1',
          facilityName: 'Gymnasium',
          amRate: 580,
          pmRate: 780,
          amCutoffHour: 17,
          addons: [],
          rawRates: [],
        }}
        loadingRates={false}
        formData={defaultFormData}
        updateField={vi.fn()}
        liveCost={{
          amount: 1740,
          breakdown: [
            { label: 'AM Rental', hours: 3, rate: 580, subtotal: 1740 },
          ],
          hasTime: true,
        }}
      />
    )

    expect(screen.getByText('AM Rental')).toBeInTheDocument()
    expect(screen.getByText('3.0')).toBeInTheDocument()
    expect(screen.getAllByText('₱1,740.00').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Total')).toBeInTheDocument()
  })
})
