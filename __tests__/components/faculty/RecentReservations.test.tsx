import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecentReservations } from '@/app/faculty/_components/RecentReservations'

const mockReservations = [
  { id: '1', facility: 'Room 101', building: 'Main', date: '2026-04-01', time: '09:00 - 10:00', status: 'confirmed' as const },
  { id: '2', facility: 'Lab A', building: 'Annex', date: '2026-04-02', time: '14:00 - 15:00', status: 'pending' as const },
  { id: '3', facility: 'Room 202', building: 'Main', date: '2026-03-28', time: '11:00 - 12:00', status: 'completed' as const },
  { id: '4', facility: 'Room 303', building: 'Main', date: '2026-03-27', time: '08:00 - 09:00', status: 'cancelled' as const },
  { id: '5', facility: 'Lab B', building: 'Annex', date: '2026-03-26', time: '10:00 - 11:00', status: 'declined' as const },
]

describe('Faculty RecentReservations', () => {
  it('should render all reservation rows', () => {
    render(<RecentReservations reservations={mockReservations} />)

    expect(screen.getByText('Room 101')).toBeDefined()
    expect(screen.getByText('Lab A')).toBeDefined()
    expect(screen.getByText('Room 202')).toBeDefined()
  })

  it('should render building names', () => {
    render(<RecentReservations reservations={mockReservations} />)

    const mainTexts = screen.getAllByText('Main')
    expect(mainTexts.length).toBeGreaterThanOrEqual(3)
  })

  it('should render status badges', () => {
    render(<RecentReservations reservations={mockReservations} />)

    expect(screen.getByText('Confirmed')).toBeDefined()
    expect(screen.getByText('Pending')).toBeDefined()
    expect(screen.getByText('Completed')).toBeDefined()
    expect(screen.getByText('Cancelled')).toBeDefined()
    expect(screen.getByText('Declined')).toBeDefined()
  })

  it('should render dates and times', () => {
    render(<RecentReservations reservations={mockReservations} />)

    expect(screen.getByText('2026-04-01')).toBeDefined()
    expect(screen.getByText('09:00 - 10:00')).toBeDefined()
  })

  it('should render View All link', () => {
    render(<RecentReservations reservations={mockReservations} />)

    const link = screen.getByRole('link', { name: /view all reservations/i })
    expect(link.getAttribute('href')).toBe('/faculty/reservations')
  })

  it('should render title', () => {
    render(<RecentReservations reservations={mockReservations} />)

    expect(screen.getByText('Recent Reservations')).toBeDefined()
  })
})
