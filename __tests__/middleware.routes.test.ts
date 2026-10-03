import { describe, it, expect } from 'vitest'
import { PUBLIC_PAGE_ROUTES, ROUTE_ROLE_MAP, ROLE_HOME } from '@/lib/routes'

// Snapshot of the literals that lived in middleware.ts before the Phase-0
// refactor. The derived constants must stay byte-identical so middleware
// behavior is unchanged.

describe('middleware route constants (behavior snapshot)', () => {
  it('PUBLIC_PAGE_ROUTES matches the pre-refactor PUBLIC_ROUTES literal', () => {
    expect(PUBLIC_PAGE_ROUTES).toEqual([
      '/',
      '/login',
      '/signup',
      '/client/login',
      '/auth/callback',
      '/auth/verify-email',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/change-password',
      '/unauthorized',
      '/api',
    ])
  })

  it('ROUTE_ROLE_MAP matches the pre-refactor literal, including key order', () => {
    const expected: Record<string, string[]> = {
      '/admin/users': ['it_admin'],
      '/admin/pamo': ['pamo_officer'],
      '/admin/building': ['building_admin'],
      '/academic': ['academic_head'],
      '/program': ['program_head'],
      '/faculty': ['faculty'],
      '/internal': ['faculty', 'program_head', 'academic_head'],
      '/client': ['external_client'],
      '/reservations': ['faculty', 'program_head', 'academic_head', 'building_admin', 'external_client'],
    }
    expect(ROUTE_ROLE_MAP).toEqual(expected)
    // First prefix match wins in middleware, so key order is behavior.
    expect(Object.keys(ROUTE_ROLE_MAP)).toEqual(Object.keys(expected))
  })

  it('ROLE_HOME matches backend/auth ROLE_ROUTES literal', () => {
    expect(ROLE_HOME).toEqual({
      it_admin: '/admin/users',
      pamo_officer: '/admin/pamo',
      building_admin: '/admin/building',
      academic_head: '/academic/dashboard',
      program_head: '/program/dashboard',
      faculty: '/faculty/dashboard',
      external_client: '/client/dashboard',
    })
  })
})
