/**
 * Root Middleware for ReserveIT
 *
 * Handles:
 * 1. Session refresh via Supabase
 * 2. Authentication checks for protected routes
 * 3. Role-based access control for dashboards
 *
 * CORS: Not configured intentionally. All API routes are consumed by the
 * same-origin Next.js frontend. Cross-origin browser requests are blocked
 * by default (no Access-Control-Allow-Origin header). Server-to-server
 * requests (curl, etc.) are permitted but require valid auth tokens.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { PUBLIC_PAGE_ROUTES as PUBLIC_ROUTES, ROUTE_ROLE_MAP } from '@/lib/routes'

// In-memory role cache per Edge isolate. TTL bounds how long a revoked or
// downgraded role keeps prior dashboard access — kept short since it can't be
// invalidated across isolates on role change.
// ponytail: 30s TTL is the whole mitigation; per-user invalidation only if the
// window ever proves too wide.
const roleCache = new Map<string, { roles: string[]; expiresAt: number }>()
const ROLE_TTL_MS = 30_000
const MAX_ROLE_CACHE_SIZE = 500

function getCachedRoles(userId: string): string[] | null {
  const entry = roleCache.get(userId)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    roleCache.delete(userId)
    return null
  }
  return entry.roles
}

function setCachedRoles(userId: string, roles: string[]): void {
  if (roleCache.size >= MAX_ROLE_CACHE_SIZE) {
    const oldestKey = roleCache.keys().next().value
    if (oldestKey) roleCache.delete(oldestKey)
  }
  roleCache.set(userId, { roles, expiresAt: Date.now() + ROLE_TTL_MS })
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes BEFORE any Supabase operations
  // This is critical for /auth/callback — touching cookies before
  // exchangeCodeForSession() corrupts the PKCE code_verifier
  const isPublicRoute = PUBLIC_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )

  if (isPublicRoute) {
    return NextResponse.next({ request })
  }

  // Create response that we'll modify with cookies
  let response = NextResponse.next({ request })

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Middleware] CRITICAL: Supabase env vars not set — failing closed')
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }


  // Create Supabase client with cookie handling
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Refresh session and get user
  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()

  // Create a fresh client for RPC calls that uses the definitely-current token
  const rpcClient = session ? createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return []
      },
      setAll() {},
    },
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    }
  }) : supabase


  // Require authentication for all other routes
  if (!user) {
    // External client routes get a dedicated login page; everything else → landing
    if (pathname.startsWith('/client')) {
      return NextResponse.redirect(new URL('/client/login', request.url))
    }
    console.log('[Middleware] No user, redirecting to home')
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Check role-based access for protected routes based on DB roles
  for (const [routePrefix, requiredRoles] of Object.entries(ROUTE_ROLE_MAP)) {
    if (pathname.startsWith(routePrefix)) {
      let userRoles: string[]
      let cacheHit = false

      const cached = getCachedRoles(user.id)
      if (cached) {
        userRoles = cached
        cacheHit = true
      } else {
        // Get user roles from database using the authenticated client
        const { data: userProfile, error: profileErr } = await rpcClient.rpc('get_current_user_with_roles')

        if (profileErr) {
          console.error(`[Middleware] RPC Error fetching roles:`, profileErr)
          // On DB failure, block only admin-level routes; allow others through
          // ponytail: transient DB errors should not lock out all authenticated users
          const isAdminRoute = routePrefix.startsWith('/admin')
          if (isAdminRoute) {
            return NextResponse.redirect(new URL('/unauthorized', request.url))
          }
          return response
        }

        userRoles = userProfile?.roles?.map((r: { name: string }) => r.name) || []
        setCachedRoles(user.id, userRoles)
      }

      response.headers.set('x-rolecache', cacheHit ? 'hit' : 'miss')

      // Check if user has any of the required roles (normalizing 'pamo' alias to 'pamo_officer')
      const normalizedUserRoles = userRoles.map(r => (r === 'pamo' ? 'pamo_officer' : r))
      const hasAccess = requiredRoles.some(role => userRoles.includes(role) || normalizedUserRoles.includes(role))

      if (!hasAccess) {
        console.log(`[Middleware] User lacks role for ${routePrefix}, roles found: ${userRoles.join(',')}, redirecting to unauthorized`)
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }

      break
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

