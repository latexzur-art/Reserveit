import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuickActions } from '@/app/program/_components/QuickActions'
import { FilePlus, FileText, Calendar, Clock } from 'lucide-react'

describe('QuickActions', () => {
  const mockActions = [
    { title: 'New Reservation', description: 'Book a facility', icon: FilePlus, href: '/program/form', color: '' },
    { title: 'My Reservations', description: 'View your bookings', icon: FileText, href: '/program/reservations', color: '' },
    { title: 'Check Availability', description: 'Browse facilities', icon: Calendar, href: '/program/calendar', color: '' },
    { title: 'Schedule Management', description: 'Manage class schedules', icon: Clock, href: '/program/schedule-management', color: '' },
  ]

  it('should render the Quick Actions header', () => {
    render(<QuickActions actions={mockActions} />)

    expect(screen.getByText('Quick Actions')).toBeDefined()
  })

  it('should render all action items', () => {
    render(<QuickActions actions={mockActions} />)

    expect(screen.getByText('New Reservation')).toBeDefined()
    expect(screen.getByText('My Reservations')).toBeDefined()
    expect(screen.getByText('Check Availability')).toBeDefined()
    expect(screen.getByText('Schedule Management')).toBeDefined()
  })

  it('should render descriptions', () => {
    render(<QuickActions actions={mockActions} />)

    expect(screen.getByText('Book a facility')).toBeDefined()
    expect(screen.getByText('View your bookings')).toBeDefined()
  })

  it('should render links with correct hrefs', () => {
    render(<QuickActions actions={mockActions} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(4)

    const hrefs = links.map(l => l.getAttribute('href'))
    expect(hrefs).toContain('/program/form')
    expect(hrefs).toContain('/program/reservations')
    expect(hrefs).toContain('/program/calendar')
    expect(hrefs).toContain('/program/schedule-management')
  })
})
