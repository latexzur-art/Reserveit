import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FacilityMultiSelect } from '@/components/shared/schedule-events/FacilityMultiSelect'

const facilities = [
  { id: 'f1', name: 'Gym', room_number: 'G1' },
  { id: 'f2', name: 'Auditorium', room_number: 'A1' },
  { id: 'f3', name: 'Room 101', room_number: '101' },
]

function openPopover() {
  fireEvent.click(screen.getByRole('button', { name: /select facilities|facilit(y|ies) selected|select venue/i }))
}

describe('FacilityMultiSelect', () => {
  it('toggling "Select All" checks every facility', () => {
    const onChange = vi.fn()
    render(<FacilityMultiSelect facilities={facilities} selectedIds={[]} onChange={onChange} />)
    openPopover()

    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }))

    expect(onChange).toHaveBeenCalledWith(['f1', 'f2', 'f3'])
  })

  it('toggling "Select All" when all are already selected unchecks every facility', () => {
    const onChange = vi.fn()
    render(<FacilityMultiSelect facilities={facilities} selectedIds={['f1', 'f2', 'f3']} onChange={onChange} />)
    openPopover()

    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('individual toggles update the Select All checkbox\'s indeterminate/checked state correctly', () => {
    const { rerender } = render(<FacilityMultiSelect facilities={facilities} selectedIds={[]} onChange={vi.fn()} />)
    openPopover()

    const selectAll = screen.getByRole('checkbox', { name: /select all/i })
    expect(selectAll).not.toBeChecked()
    expect(selectAll.getAttribute('data-state')).toBe('unchecked')

    rerender(<FacilityMultiSelect facilities={facilities} selectedIds={['f1']} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /select all/i }).getAttribute('data-state')).toBe('indeterminate')

    rerender(<FacilityMultiSelect facilities={facilities} selectedIds={['f1', 'f2', 'f3']} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /select all/i }).getAttribute('data-state')).toBe('checked')
  })

  it('toggling an individual facility adds it to the selection', () => {
    const onChange = vi.fn()
    render(<FacilityMultiSelect facilities={facilities} selectedIds={['f1']} onChange={onChange} />)
    openPopover()

    fireEvent.click(screen.getByRole('checkbox', { name: /auditorium/i }))

    expect(onChange).toHaveBeenCalledWith(['f1', 'f2'])
  })

  it('search input filters the visible facility list', () => {
    render(<FacilityMultiSelect facilities={facilities} selectedIds={[]} onChange={vi.fn()} />)
    openPopover()

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'gym' } })

    expect(screen.getByText('Gym')).toBeInTheDocument()
    expect(screen.queryByText('Auditorium')).not.toBeInTheDocument()
  })
})
