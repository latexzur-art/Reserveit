import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsCards } from '@/app/faculty/_components/StatsCards'

describe('Faculty StatsCards', () => {
  const defaultStats = {
    totalReservations: 10,
    pendingRequests: 3,
    upcomingBookings: 5,
    activeReservations: 2,
  }

  it('should render all 4 stat cards', () => {
    render(<StatsCards stats={defaultStats} />)

    expect(screen.getByText('Total Reservations')).toBeDefined()
    expect(screen.getByText('Pending Requests')).toBeDefined()
    expect(screen.getByText('Upcoming Bookings')).toBeDefined()
    expect(screen.getByText('Active Today')).toBeDefined()
  })

  it('should render stat values', () => {
    render(<StatsCards stats={defaultStats} />)

    expect(screen.getByText('10')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
  })

  it('should render trend text', () => {
    render(<StatsCards stats={defaultStats} />)

    expect(screen.getByText('All bookings')).toBeDefined()
    expect(screen.getByText('Awaiting approval')).toBeDefined()
    expect(screen.getByText('This week')).toBeDefined()
    expect(screen.getByText('Currently in use')).toBeDefined()
  })

  it('should handle zero stats', () => {
    render(<StatsCards stats={{
      totalReservations: 0,
      pendingRequests: 0,
      upcomingBookings: 0,
      activeReservations: 0,
    }} />)

    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(4)
  })
})
