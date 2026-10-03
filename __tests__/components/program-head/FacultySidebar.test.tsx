import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FacultySidebar } from '@/app/program/_components/FacultySidebar'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/program/dashboard'),
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('ProgramHead FacultySidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render all navigation items', () => {
    render(<FacultySidebar />)

    expect(screen.getByText('Dashboard')).toBeDefined()
    expect(screen.getByText('My Schedules')).toBeDefined()
    expect(screen.getByText('Notifications')).toBeDefined()
    expect(screen.getByText('New Reservation')).toBeDefined()
    expect(screen.getByText('My Reservations')).toBeDefined()
    expect(screen.getByText('Calendar')).toBeDefined()
    expect(screen.getByText('Payment')).toBeDefined()
    expect(screen.getByText('Approved Schedules')).toBeDefined()
    expect(screen.getByText('Schedule Uploads')).toBeDefined()
    expect(screen.getByText('Curriculum')).toBeDefined()
    expect(screen.getByText('Courses')).toBeDefined()
  })

  it('should render the branding', () => {
    render(<FacultySidebar />)

    // Logo image + RESERVEIT wordmark
    expect(screen.getByAltText('ReserveIT Logo')).toBeDefined()
  })

  it('should render the Help Center control', () => {
    render(<FacultySidebar />)

    expect(screen.getByText('Help Center')).toBeDefined()
  })

  it('should link Payment to the payment page', () => {
    render(<FacultySidebar />)

    const paymentLink = screen.getByText('Payment').closest('a')
    expect(paymentLink?.getAttribute('href')).toBe('/program/payment')
  })

  it('should have correct hrefs for enabled items', () => {
    render(<FacultySidebar />)

    const dashboardLink = screen.getByText('Dashboard').closest('a')
    expect(dashboardLink?.getAttribute('href')).toBe('/program/dashboard')

    const reservationsLink = screen.getByText('My Reservations').closest('a')
    expect(reservationsLink?.getAttribute('href')).toBe('/program/reservations')
  })
})
