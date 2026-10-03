import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimePicker, to24h, from24h } from '@/components/ui/time-picker'

describe('time conversion helpers', () => {
  it('to24h converts 12h + AM/PM to 24h HH:mm', () => {
    expect(to24h('8', '30', 'AM')).toBe('08:30')
    expect(to24h('5', '0', 'PM')).toBe('17:00')
    expect(to24h('12', '0', 'AM')).toBe('00:00')
    expect(to24h('12', '0', 'PM')).toBe('12:00')
  })

  it('to24h returns null for incomplete or invalid parts', () => {
    expect(to24h('', '30', 'AM')).toBeNull()
    expect(to24h('13', '00', 'AM')).toBeNull()
    expect(to24h('8', '60', 'AM')).toBeNull()
  })

  it('from24h splits 24h HH:mm into 12h parts', () => {
    expect(from24h('14:30')).toEqual({ hour: '02', minute: '30', period: 'PM' })
    expect(from24h('00:15')).toEqual({ hour: '12', minute: '15', period: 'AM' })
    expect(from24h('')).toEqual({ hour: '', minute: '', period: 'AM' })
  })
})

describe('TimePicker (segmented, typable)', () => {
  it('names the hour and minute segment inputs by field', () => {
    render(<TimePicker value="" onChange={() => {}} ariaLabel="Start time" />)
    expect(screen.getByLabelText('Start time hour')).toBeDefined()
    expect(screen.getByLabelText('Start time minutes')).toBeDefined()
    expect(screen.getByRole('button', { name: 'AM' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'PM' })).toBeDefined()
  })

  it('emits 24h HH:mm when the hour and minute are typed', () => {
    const onChange = vi.fn()
    render(<TimePicker value="" onChange={onChange} ariaLabel="Start time" />)
    fireEvent.change(screen.getByLabelText('Start time hour'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Start time minutes'), { target: { value: '30' } })
    expect(onChange).toHaveBeenLastCalledWith('08:30')
  })

  it('re-converts when AM/PM button is clicked', () => {
    const onChange = vi.fn()
    render(<TimePicker value="08:00" onChange={onChange} ariaLabel="Start time" />)
    fireEvent.click(screen.getByRole('button', { name: 'PM' }))
    expect(onChange).toHaveBeenLastCalledWith('20:00')
  })

  it('reflects a controlled value as 12h parts and active period', () => {
    render(<TimePicker value="14:30" onChange={() => {}} ariaLabel="Start time" />)
    expect((screen.getByLabelText('Start time hour') as HTMLInputElement).value).toBe('02')
    expect((screen.getByLabelText('Start time minutes') as HTMLInputElement).value).toBe('30')
    const pmButton = screen.getByRole('button', { name: 'PM' })
    expect(pmButton.className).toContain('bg-sti-blue')
  })

  it('clearing both hour and minute emits an empty (no-window) value', () => {
    const onChange = vi.fn()
    render(<TimePicker value="08:30" onChange={onChange} ariaLabel="Start time" />)
    fireEvent.change(screen.getByLabelText('Start time hour'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Start time minutes'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith('')
  })
})
