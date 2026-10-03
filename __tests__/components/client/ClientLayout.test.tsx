import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock next/navigation
const mockUsePathname = vi.fn(() => '/client/login')
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

// Mock contexts
vi.mock('@/contexts/UIContext', () => ({
  useUI: () => ({ textSizeEnlarged: false }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    user: null,
  }),
}))

// Mock ClientLayoutContext
vi.mock('@/app/client/_components/ClientLayoutContext', () => ({
  useClientLayout: () => ({
    mobileMenuOpen: false,
    setMobileMenuOpen: vi.fn(),
  }),
  ClientLayoutProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock components
vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster" />,
}))

vi.mock('@/components/errors/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ai/AssistantMount', () => ({
  AssistantMount: () => <div data-testid="assistant-mount" />,
}))

vi.mock('@/components/help/HelpSheet', () => ({
  HelpSheet: () => <div data-testid="help-sheet" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, ...props }: any) => <div data-testid="sheet" {...props}>{children}</div>,
  SheetContent: ({ children, ...props }: any) => <div data-testid="sheet-content" {...props}>{children}</div>,
}))

import ClientLayout from '@/app/client/layout'
import { ClientSidebar } from '@/app/client/_components/ClientSidebar'

describe('ClientLayout - Sidebar visibility on login page', () => {
  it('should NOT render the sidebar when on the login page', () => {
    render(
      <ClientLayout>
        <div>Login Page Content</div>
      </ClientLayout>
    )

    // The sidebar should NOT be visible on the login page
    const sidebar = screen.queryByRole('complementary') // <aside> has role="complementary"
    expect(sidebar).not.toBeInTheDocument()
  })

  it('should render the sidebar on non-login client pages', async () => {
    // Re-mock usePathname to return a non-login route
    mockUsePathname.mockReturnValue('/client/dashboard')

    render(
      <ClientLayout>
        <div>Dashboard Content</div>
      </ClientLayout>
    )

    // The sidebar SHOULD be visible on non-login pages
    const sidebar = screen.queryByRole('complementary')
    expect(sidebar).toBeInTheDocument()
  })
})
