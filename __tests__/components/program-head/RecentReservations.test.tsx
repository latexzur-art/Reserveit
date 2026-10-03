import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecentReservations } from '@/app/program/_components/RecentReservations'

describe('RecentReservations', () => {
  const mockReservations = [
    { id: 'r1', facility: 'Room 101', building: 'Main Building', date: '2026-04-01', time: '09:00 - 10:00', status: 'confirmed' as const },
    { id: 'r2', facility: 'Lab 202', building: 'Annex', date: '2026-04-02', time: '14:00 - 15:00', status: 'pending' as const },
    { id: 'r3', facility: 'Hall A', building: 'Events Center', date: '2026-03-30', time: '08:00 - 12:00', status: 'cancelled' as const },
  ]

  it('should render the section header', () => {
    render(<RecentReservations reservations={mockReservations} />)

    expect(screen.getByText('Recent Reservations')).toBeDefined()
    expect(screen.getByText(/View all/)).toBeDefined()
  })

  it('should render all reservation rows', () => {
    render(<RecentReservations reservations={mockReservations} />)

    expect(screen.getByText('Room 101')).toBeDefined()
    expect(screen.getByText('Lab 202')).toBeDefined()
    expect(screen.getByText('Hall A')).toBeDefined()
  })

  it('should render building names', () => {
    render(<RecentReservations reservations={mockReservations} />)

    expect(screen.getByText('Main Building')).toBeDefined()
    expect(screen.getByText('Annex')).toBeDefined()
    expect(screen.getByText('Events Center')).toBeDefined()
  })

  it('should render time slots', () => {
    render(<RecentReservations reservations={mockReservations} />)

    expect(screen.getByText('09:00 - 10:00')).toBeDefined()
    expect(screen.getByText('14:00 - 15:00')).toBeDefined()
    expect(screen.getByText('08:00 - 12:00')).toBeDefined()
  })

  it('should render status badges', () => {
    render(<RecentReservations reservations={mockReservations} />)

    expect(screen.getByText('Confirmed')).toBeDefined()
    expect(screen.getByText('Pending')).toBeDefined()
    expect(screen.getByText('Cancelled')).toBeDefined()
  })

  it('should render table headers', () => {
    render(<RecentReservations reservations={mockReservations} />)

    expect(screen.getByText('Room')).toBeDefined()
    expect(screen.getByText('Building')).toBeDefined()
    expect(screen.getByText(/Date/)).toBeDefined()
    expect(screen.getByText('Status')).toBeDefined()
  })

  it('should render empty state when no reservations', () => {
    render(<RecentReservations reservations={[]} />)

    expect(screen.getByText('No reservations yet')).toBeDefined()
    expect(screen.getByText(/Make a reservation/)).toBeDefined()
  })

  it('should format dates correctly', () => {
    render(<RecentReservations reservations={[
      { id: 'r1', facility: 'Room 101', building: 'Main', date: '2026-04-01', time: '09:00', status: 'pending' },
    ]} />)

    // Should format as "Apr 01, 2026" (en-US short month)
    expect(screen.getByText(/Apr/)).toBeDefined()
  })
})
