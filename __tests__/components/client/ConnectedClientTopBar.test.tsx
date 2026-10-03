import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mocks must be declared before the subject import
vi.mock('@/components/shared/RoleTopBar', () => ({
  RoleTopBar: (props: any) => (
    <div
      data-testid="role-top-bar"
      data-form-route={props.formRoute}
      data-calendar-route={props.calendarRoute}
      data-title={props.title}
    />
  ),
}))
vi.mock('@/app/client/_components/ClientLayoutContext', () => ({
  useClientLayout: () => ({ toggleMobileMenu: vi.fn() }),
}))
vi.mock('@/hooks/notifications/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    clearAll: vi.fn(),
  }),
}))
vi.mock('@/components/layout/shared/UserProfile', () => ({
  UserProfile: () => <div data-testid="user-profile" />,
}))

import { ConnectedClientTopBar } from '@/app/client/_components/ConnectedClientTopBar'

describe('ConnectedClientTopBar', () => {
  it('renders RoleTopBar with client booking and calendar routes', () => {
    render(<ConnectedClientTopBar title="Dashboard" />)
    const bar = screen.getByTestId('role-top-bar')
    expect(bar).toBeInTheDocument()
    expect(bar.getAttribute('data-form-route')).toBe('/client/booking')
    expect(bar.getAttribute('data-calendar-route')).toBe('/client/calendar')
  })

  it('passes title through to RoleTopBar', () => {
    render(<ConnectedClientTopBar title="Control Center" />)
    expect(screen.getByTestId('role-top-bar').getAttribute('data-title')).toBe('Control Center')
  })

  it('uses default title when none provided', () => {
    render(<ConnectedClientTopBar />)
    expect(screen.getByTestId('role-top-bar').getAttribute('data-title')).toBe('ReserveIT')
  })
})
