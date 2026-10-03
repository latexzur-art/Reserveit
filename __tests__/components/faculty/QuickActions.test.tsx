import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuickActions } from '@/app/faculty/_components/QuickActions'
import { Plus, FileText, CalendarDays, User } from 'lucide-react'

const mockActions = [
  { title: 'New Reservation', description: 'Book a facility', icon: Plus, href: '/faculty/form', color: 'bg-blue-500' },
  { title: 'My Reservations', description: 'View your bookings', icon: FileText, href: '/faculty/reservations', color: 'bg-green-500' },
  { title: 'Check Availability', description: 'Browse facilities', icon: CalendarDays, href: '/faculty/calendar', color: 'bg-purple-500' },
  { title: 'Update Profile', description: 'Edit your info', icon: User, href: '/faculty/profile', color: 'bg-orange-500' },
]

describe('Faculty QuickActions', () => {
  it('should render all action cards', () => {
    render(<QuickActions actions={mockActions} />)

    expect(screen.getByText('New Reservation')).toBeDefined()
    expect(screen.getByText('My Reservations')).toBeDefined()
    expect(screen.getByText('Check Availability')).toBeDefined()
    expect(screen.getByText('Update Profile')).toBeDefined()
  })

  it('should render descriptions', () => {
    render(<QuickActions actions={mockActions} />)

    expect(screen.getByText('Book a facility')).toBeDefined()
    expect(screen.getByText('View your bookings')).toBeDefined()
  })

  it('should link to correct hrefs', () => {
    render(<QuickActions actions={mockActions} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(4)
    expect(links[0].getAttribute('href')).toBe('/faculty/form')
    expect(links[1].getAttribute('href')).toBe('/faculty/reservations')
    expect(links[2].getAttribute('href')).toBe('/faculty/calendar')
    expect(links[3].getAttribute('href')).toBe('/faculty/profile')
  })

  it('should render heading', () => {
    render(<QuickActions actions={mockActions} />)

    expect(screen.getByText('Quick Actions')).toBeDefined()
  })
})
