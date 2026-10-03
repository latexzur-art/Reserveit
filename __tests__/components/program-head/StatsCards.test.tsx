import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsCards } from '@/app/program/_components/StatsCards'

// Mock requestAnimationFrame to run tick once with elapsed time past duration
// so the animation completes immediately without infinite loop
let rafId = 0
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  // Don't call cb synchronously to avoid infinite recursion
  // Just return an id - the component will show initial value (0)
  return ++rafId
})
vi.stubGlobal('cancelAnimationFrame', vi.fn())

describe('StatsCards', () => {
  const defaultStats = {
    totalReservations: 10,
    pendingRequests: 3,
    upcomingBookings: 5,
    activeReservations: 2,
  }

  it('should render all 4 base stat cards', () => {
    render(<StatsCards stats={defaultStats} />)

    expect(screen.getByText('Total Reservations')).toBeDefined()
    expect(screen.getByText('Pending Requests')).toBeDefined()
    expect(screen.getByText('Upcoming Bookings')).toBeDefined()
    expect(screen.getByText('Active Today')).toBeDefined()
  })

  it('should render 5th card when pendingChangeRequests is provided', () => {
    render(<StatsCards stats={{ ...defaultStats, pendingChangeRequests: 4 }} />)

    expect(screen.getByText('Change Requests')).toBeDefined()
  })

  it('should not render Change Requests card without pendingChangeRequests', () => {
    render(<StatsCards stats={defaultStats} />)

    expect(screen.queryByText('Change Requests')).toBeNull()
  })

  it('should render trend text for each card', () => {
    render(<StatsCards stats={defaultStats} />)

    expect(screen.getByText('Lifetime bookings')).toBeDefined()
    expect(screen.getByText('Awaiting approval')).toBeDefined()
    expect(screen.getByText('Scheduled this week')).toBeDefined()
    expect(screen.getByText('Reservations + Classes')).toBeDefined()
  })

  it('should handle zero stats', () => {
    render(<StatsCards stats={{
      totalReservations: 0,
      pendingRequests: 0,
      upcomingBookings: 0,
      activeReservations: 0,
    }} />)

    // All values start at 0, and target is 0 so they stay at 0
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(4)
  })
})
