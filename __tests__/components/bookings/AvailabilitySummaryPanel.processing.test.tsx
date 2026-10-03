import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AvailabilitySummaryPanel } from '@/components/bookings/form/AvailabilitySummaryPanel'

// Minimal props — only the fields the "processing" banner branch reads.
const baseProps = {
  formData: {
    facility_id: '', booking_date: '', start_time: '', end_time: '',
    booking_purpose: '', purpose: '', event_name: '', expected_attendees: '',
    special_requests: '', facility_purpose_category: '', mismatch_justification: '',
    booking_course_code: '', booking_department_code: '', session_type: '' as const,
  },
  updateField: () => {},
  availability: null,
  loadingAvailability: false,
  selectedFacility: null,
  reset: () => {},
}

describe('AvailabilitySummaryPanel processing banner', () => {
  it('shows an in-progress icon (not a success checkmark) while status is processing', () => {
    render(
      <AvailabilitySummaryPanel
        {...baseProps}
        submitResult={{ status: 'processing', booking_id: 'b1', booking_reference: 'REF-1' } as any}
      />
    )

    expect(screen.getByTestId('status-icon-processing')).toBeDefined()
    expect(screen.queryByTestId('status-icon-success')).toBeNull()
  })
})
