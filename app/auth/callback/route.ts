import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { getDefaultRoute } from '@/backend/auth/auth.utils'


export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors from provider
  if (error) {
    console.error('[Auth Route] OAuth error:', error, errorDescription)
    const friendlyMessage = 'Authentication failed. Please try signing in again.'
    return NextResponse.redirect(
      `${origin}/auth/callback/complete?error=${error}&error_description=${encodeURIComponent(friendlyMessage)}`
    )
  }

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'signup' | 'magiclink' | 'recovery' | 'email_change' | null

  if (tokenHash && type) {
    const cookieStore = await cookies()
    let responseCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

    const redirectWithCookies = (url: string): NextResponse => {
      const response = NextResponse.redirect(url)
      responseCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            responseCookies = cookiesToSet
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

    if (verifyError) {
      console.error('[Auth Route] verifyOtp error:', verifyError.message)
      return redirectWithCookies(
        `${origin}/auth/callback/complete?error=verify_failed&error_description=${encodeURIComponent('Email verification failed. Please try signing in again.')}`
      )
    }

    const { data: userProfile } = await supabase.rpc('get_current_user_with_roles')
    if (userProfile && !userProfile.notification_email) {
      console.log('[Auth Route] External user missing notification_email, redirecting to setup')
      return redirectWithCookies(`${origin}/auth/setup-notification`)
    }

    console.log('[Auth Route] OTP verified successfully, type:', type)
    return redirectWithCookies(`${origin}/client/dashboard`)
  }

  if (code) {
    const cookieStore = await cookies()

    // Track cookies that Supabase sets so we can apply them to the redirect response.
    // NextResponse.redirect() creates a new Response; cookies set via cookieStore.set()
    // do not automatically propagate to it.
    let responseCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

    const redirectWithCookies = (url: string): NextResponse => {
      const response = NextResponse.redirect(url)
      responseCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            responseCookies = cookiesToSet
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[Auth Route] Exchange error:', exchangeError.message)
      return redirectWithCookies(
        `${origin}/auth/callback/complete?error=exchange_failed&error_description=${encodeURIComponent('Authentication failed. Please try signing in again.')}`
      )
    }

    console.log('[Auth Route] Code exchanged successfully')

    // Check which provider was used
    const { data: { session } } = await supabase.auth.getSession()
    const provider = session?.user?.app_metadata?.provider

    console.log('[Auth Route] Provider:', provider)

    // Check user profile with roles (works for Azure, Google, and email logins)
    let { data: userProfile, error: profileError } = await supabase.rpc('get_current_user_with_roles')

    if (profileError) {
      console.error('[Auth Route] Profile error:', profileError.message)
    }

    // Admin (service-role) client for linking / diagnosing the profile on the unhappy path.
    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    )

    // Fallback & Auto-Provisioning: Check for unlinked profile or auto-create Faculty profile based on Entra display name.
    if (!userProfile && session?.user?.email) {
      const loginEmail = session.user.email.toLowerCase()
      const meta = session.user.user_metadata || {}
      const displayName = String(meta.full_name || meta.name || meta.custom_claims?.name || '')

      console.log('[Auth Route] Checking profile for login email:', loginEmail, 'displayName:', displayName)

      const { data: unlinkedUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', loginEmail)
        .is('auth_user_id', null)

      if (unlinkedUsers && unlinkedUsers.length > 0) {
        console.log('[Auth Route] Found pre-created unlinked profile! Linking to auth_user_id:', session.user.id)

        await supabaseAdmin
          .from('users')
          .update({
            auth_user_id: session.user.id,
            email_verified: true,
            account_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', unlinkedUsers[0].id)

        // Retry getting the profile
        const { data: retryProfile } = await supabase.rpc('get_current_user_with_roles')
        userProfile = retryProfile
      } else if (provider === 'azure') {
        if (displayName.toLowerCase().includes('(student)')) {
          console.log('[Auth Route] Student login blocked:', loginEmail, displayName)
          return redirectWithCookies(
            `${origin}/auth/callback/complete?error=student_access_denied&error_description=${encodeURIComponent('Student accounts are not authorized to access ReserveIT.')}`
          )
        } else if (displayName.toLowerCase().includes('(faculty)') || displayName.toLowerCase().includes('(staff)')) {
          console.log('[Auth Route] Auto-provisioning STI Faculty user:', loginEmail)

          const { data: facultyRole } = await supabaseAdmin
            .from('roles')
            .select('id')
            .eq('name', 'faculty')
            .single()

          if (facultyRole) {
            const newUserId = crypto.randomUUID()
            const cleanedName = displayName.replace(/\s*\((Faculty|Staff)\)/i, '').trim() || loginEmail.split('@')[0]

            const { error: createErr } = await supabaseAdmin.from('users').insert({
              id: newUserId,
              auth_user_id: session.user.id,
              email: loginEmail,
              full_name: cleanedName,
              user_type: 'internal',
              account_status: 'active',
              email_verified: true,
            })

            if (!createErr) {
              await supabaseAdmin.from('user_roles').insert({
                user_id: newUserId,
                role_id: facultyRole.id,
                is_active: true,
              })

              const { data: createdProfile } = await supabase.rpc('get_current_user_with_roles')
              userProfile = createdProfile
            }
          }
        }
      }
    }

    if (userProfile) {
      console.log('[Auth Route] Got user profile:', userProfile.email)
      const roles = (userProfile.roles || []) as Array<string | { name: string }>
      const internalRoles: string[] = roles
        .map(r => (typeof r === 'string' ? r : r.name))
        .filter(name => name !== 'external_client')

      if (internalRoles.length === 0) {
        if (provider === 'azure') {
          console.log('[Auth Route] Azure user has no internal role assigned')
          return redirectWithCookies(
            `${origin}/auth/callback/complete?error=no_internal_role&error_description=${encodeURIComponent('Your Microsoft account is not registered as an internal user. Please contact the IT Admin.')}`
          )
        }

        // External users (Google, email/password) with only external client role
        if (!userProfile.notification_email) {
          console.log('[Auth Route] External user missing notification_email, redirecting to setup')
          return redirectWithCookies(`${origin}/auth/setup-notification`)
        }
        console.log('[Auth Route] Redirecting to /client/dashboard')
        return redirectWithCookies(`${origin}/client/dashboard`)
      }

      if (!userProfile.notification_email) {
        console.log('[Auth Route] User missing notification_email, redirecting to setup')
        return redirectWithCookies(`${origin}/auth/setup-notification`)
      }

      const redirectTo = getDefaultRoute(internalRoles)
      console.log('[Auth Route] Redirecting to:', redirectTo)
      return redirectWithCookies(`${origin}${redirectTo}`)
    } else {
      // No active, linked profile. Distinguish "exists but not usable" (archived / suspended /
      // awaiting activation) from "never created" so we don't tell an already-provisioned user
      // their account isn't set up.
      let errorCode = 'no_profile'
      let errorMessage = 'Your account is not yet set up. Please contact the IT Admin.'

      const loginEmail = session?.user?.email?.toLowerCase()
      if (loginEmail) {
        const { data: existing } = await supabaseAdmin
          .from('users')
          .select('account_status, is_active, auth_user_id')
          .eq('email', loginEmail)
          .maybeSingle()

        if (existing) {
          if (existing.is_active === false || existing.account_status === 'inactive') {
            errorCode = 'account_archived'
            errorMessage = 'Your account has been archived. Please contact the IT Admin to restore it.'
          } else if (existing.account_status === 'suspended') {
            errorCode = 'account_suspended'
            errorMessage = 'Your account is suspended. Please contact the IT Admin.'
          } else if (!existing.auth_user_id) {
            errorCode = 'account_pending'
            errorMessage = 'Your account is awaiting activation. Please contact the IT Admin.'
          }
        }
      }

      console.log('[Auth Route] No usable profile, reason:', errorCode)
      return redirectWithCookies(
        `${origin}/auth/callback/complete?error=${errorCode}&error_description=${encodeURIComponent(errorMessage)}`
      )
    }
  }

  // Redirect with error if we couldn't get user info
  return NextResponse.redirect(`${origin}/auth/callback/complete?error=auth_failed&error_description=${encodeURIComponent('Could not retrieve user information')}`)
}
