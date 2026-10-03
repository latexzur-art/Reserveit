import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CalendarModal } from '@/components/shared/CalendarModal'
import { format } from 'date-fns'

describe('CalendarModal Component', () => {
  const sampleReservations = [
    {
      id: 'res-1',
      date: format(new Date(), 'yyyy-MM-dd'),
      facility: 'Gymnasium',
      time: '09:00 - 11:00',
      status: 'confirmed' as const,
    },
  ]

  const sampleClasses = [
    {
      id: 'cls-1',
      course_code: 'CS101',
      course_name: 'Intro to CS',
      section: 'BSIT-1A',
      day_of_week: new Date().getDay(),
      start_time: '08:00:00',
      end_time: '10:00:00',
      facility: { name: 'Lab 1', room_number: '301', building: 'Main' },
    },
  ]

  it('renders inline calendar grid with event labels', () => {
    render(<CalendarModal inline={true} reservations={sampleReservations} classes={sampleClasses} />)
    
    // Checks that event label Gymnasium is present
    expect(screen.getByText('Gymnasium')).toBeDefined()
    expect(screen.getAllByText('CS101 BSIT-1A').length).toBeGreaterThan(0)
  })

  it('applies brand-aligned blue selection styling (ring-blue-500 and bg-blue-500/10) when a day cell is selected', () => {
    render(<CalendarModal inline={true} reservations={sampleReservations} />)
    
    const todayCell = screen.getByText(format(new Date(), 'd')).closest('div[class*="min-h-\\[72px\\]"]')
    expect(todayCell).not.toBeNull()

    // Click today cell
    fireEvent.click(todayCell!)

    // Cell should have active ring-blue-500 and background tint
    expect(todayCell?.className).toContain('ring-blue-500')
    expect(todayCell?.className).toContain('bg-blue-500/10')
  })

  it('does not contain raw emoji prefixes in event pills', () => {
    const { container } = render(<CalendarModal inline={true} reservations={sampleReservations} classes={sampleClasses} />)
    
    // Ensure no raw pin or book emojis exist in the rendered output
    expect(container.innerHTML).not.toContain('📌')
    expect(container.innerHTML).not.toContain('📚')
  })
})
