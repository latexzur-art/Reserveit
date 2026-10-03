import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Email / Azure env vars (fake values — no real network calls in tests)
process.env.AZURE_TENANT_ID = 'test-tenant-id'
process.env.AZURE_CLIENT_ID = 'test-client-id'
process.env.AZURE_CLIENT_SECRET = 'test-client-secret'
process.env.MAIL_SENDER_ADDRESS = 'noreply@reserveitlucena.onmicrosoft.com'
// ACADEMIC_HEAD_EMAIL intentionally absent - resolved from DB via getAcademicHeadEmail()
process.env.CRON_SECRET = 'test-cron-secret'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://aascxdiyetopvrxifape.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
  })),
  headers: vi.fn(() => new Map()),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/academic/dashboard'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  redirect: vi.fn(),
}))

// Global fetch mock (reset per test)
global.fetch = vi.fn()

// jsdom has no ResizeObserver -- needed by any Radix/cmdk-based popover or combobox.
global.ResizeObserver =
  global.ResizeObserver ??
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

// jsdom doesn't implement scrollIntoView -- cmdk (Command list) calls it on selection.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
