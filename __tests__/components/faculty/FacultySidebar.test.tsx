import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FacultySidebar } from '@/app/faculty/_components/FacultySidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/faculty/dashboard',
}))

// Component reads signOut from the auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn(), loading: false }),
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('Faculty FacultySidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the core nav items', () => {
    render(<FacultySidebar />)

    expect(screen.getByText('Dashboard')).toBeDefined()
    expect(screen.getByText('New Reservation')).toBeDefined()
    expect(screen.getByText('My Reservations')).toBeDefined()
    expect(screen.getByText('Payment')).toBeDefined()
    expect(screen.getByText('Calendar')).toBeDefined()
    expect(screen.getByText('Notifications')).toBeDefined()
    expect(screen.getByText('Profile')).toBeDefined()
  })

  it('should render branding', () => {
    render(<FacultySidebar />)

    // Logo image + the RESERVEIT wordmark
    expect(screen.getByAltText('ReserveIT Logo')).toBeDefined()
  })

  it('should link Payment to the payment page', () => {
    render(<FacultySidebar />)

    const paymentLink = screen.getByText('Payment').closest('a')
    expect(paymentLink?.getAttribute('href')).toBe('/faculty/payment')
  })

  it('should have correct hrefs for nav items', () => {
    render(<FacultySidebar />)

    const dashboardLink = screen.getByText('Dashboard').closest('a')
    expect(dashboardLink?.getAttribute('href')).toBe('/faculty/dashboard')

    const formLink = screen.getByText('New Reservation').closest('a')
    expect(formLink?.getAttribute('href')).toBe('/faculty/form')

    const reservationsLink = screen.getByText('My Reservations').closest('a')
    expect(reservationsLink?.getAttribute('href')).toBe('/faculty/reservations')

    const calendarLink = screen.getByText('Calendar').closest('a')
    expect(calendarLink?.getAttribute('href')).toBe('/faculty/calendar')
  })

  it('should render the Help & FAQ control', () => {
    render(<FacultySidebar />)

    expect(screen.getByText('Help & FAQ')).toBeDefined()
  })
})
