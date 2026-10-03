/**
 * Auth helper for API route handlers.
 *
 * Uses createServerClient with cookie handling (same pattern as /api/auth/me)
 * to ensure automatic session refresh and consistent authentication.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export interface AuthResult {
  user: {
    id: string
    auth_user_id: string
    email: string
    full_name: string
    user_type: string
    account_status: string
    employee_id: string | null
    phone: string | null
    avatar_url: string | null
    roles: Array<{ id: string; name: string; displayName: string; badgeColor: string | null }>
    department: { id: string; code: string; name: string } | null
    [key: string]: unknown
  } | null
  error: string | null
}

const AUTH_TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ])
}

/**
 * Fetch user profile by auth_user_id using the admin client.
 * ponytail: direct query, no RPC, no token refresh needed.
 */
async function fetchUserProfileByAuthId(authUserId: string): Promise<AuthResult['user'] | null> {
  const { createAdminClient } = await import('@/lib/supabase/server')
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('users')
    .select(`
      id, auth_user_id, email, full_name, user_type, account_status,
      employee_id, phone, avatar_url,
      departments:department_id(id, code, name),
      user_roles(role:roles(id, name, display_name, badge_color))
    `)
    .eq('auth_user_id', authUserId)
    .eq('account_status', 'active')
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    auth_user_id: data.auth_user_id,
    email: data.email,
    full_name: data.full_name,
    user_type: data.user_type,
    account_status: data.account_status,
    employee_id: data.employee_id,
    phone: data.phone,
    avatar_url: data.avatar_url,
    roles: (data.user_roles ?? []).map((ur: any) => ({
      id: ur.role?.id,
      name: ur.role?.name,
      displayName: ur.role?.display_name,
      badgeColor: ur.role?.badge_color,
    })),
    department: (Array.isArray(data.departments) ? data.departments[0] : data.departments) as { id: string; code: string; name: string } | null,
  }
}

/**
 * Get the authenticated user with their profile and roles.
 * Tries RPC first; falls back to getUser() + admin query when token refresh fails.
 */
export async function getAuthUserWithRoles(): Promise<AuthResult> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // ponytail: setAll throws in some Next.js API route contexts;
            // token refresh won't persist but getUser() fallback handles it.
          }
        },
      },
    }
  )

  // Fast path: RPC succeeds when token is fresh
  try {
    const result = await withTimeout(
      supabase.rpc('get_current_user_with_roles') as any,
      AUTH_TIMEOUT_MS,
      'get_current_user_with_roles'
    )
    const { data: userProfile, error } = result as { data: any; error: any }

    if (!error && userProfile) {
      return { user: userProfile as AuthResult['user'], error: null }
    }
    console.error('[auth-helper] RPC returned no user:', error?.message ?? '(no profile)')
  } catch (err) {
    console.error('[auth-helper] RPC failed:', err instanceof Error ? err.message : err)
  }

  // Fallback: getUser() validates JWT server-side without needing token refresh
  try {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      console.error('[auth-helper] getUser fallback failed:', authError?.message ?? 'no user')
      return { user: null, error: 'Unauthorized' }
    }

    const profile = await fetchUserProfileByAuthId(authUser.id)
    if (!profile) {
      console.error('[auth-helper] No active profile for auth user:', authUser.id)
      return { user: null, error: 'Unauthorized' }
    }

    return { user: profile, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown auth error'
    console.error('[auth-helper] Auth failed:', message)
    return { user: null, error: 'Unauthorized' }
  }
}
