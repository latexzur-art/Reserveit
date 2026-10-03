import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DateField } from '@/components/bookings/form/DateField'

describe('DateField', () => {
  it('renders trigger button with placeholder when empty', () => {
    render(<DateField value="" onChange={vi.fn()} />)
    expect(screen.getByText('Pick a date')).toBeDefined()
  })

  it('renders formatted date when value is provided', () => {
    render(<DateField value="2026-08-18" onChange={vi.fn()} />)
    expect(screen.getByText(/Aug(ust)? 18/i)).toBeDefined()
  })

  it('disables Sunday dates by default when popover is open', () => {
    render(<DateField value="2026-08-18" onChange={vi.fn()} />)
    // Open calendar popover
    fireEvent.click(screen.getByRole('button', { name: /Aug(ust)? 18/i }))

    // Sunday Aug 16, 2026 button should be disabled
    const sundayBtn = screen.getByText('16').closest('button')
    expect(sundayBtn).not.toBeNull()
    expect(sundayBtn?.hasAttribute('disabled') || sundayBtn?.getAttribute('aria-disabled') === 'true').toBe(true)

    // Tuesday Aug 18, 2026 button should be enabled
    const tuesdayBtn = screen.getByText('18').closest('button')
    expect(tuesdayBtn).not.toBeNull()
    expect(tuesdayBtn?.hasAttribute('disabled')).toBe(false)
  })

  it('allows Sunday dates when allowSunday={true}', () => {
    render(<DateField value="2026-08-18" onChange={vi.fn()} allowSunday={true} />)
    // Open calendar popover
    fireEvent.click(screen.getByRole('button', { name: /Aug(ust)? 18/i }))

    // Sunday Aug 16, 2026 button should now be enabled
    const sundayBtn = screen.getByText('16').closest('button')
    expect(sundayBtn).not.toBeNull()
    expect(sundayBtn?.hasAttribute('disabled')).toBe(false)
  })
})
