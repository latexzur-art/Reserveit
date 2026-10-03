import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * Server-side Google OAuth initiation.
 * Bypasses the browser Supabase client (which hangs with Next.js 16/React 19)
 * by generating the OAuth URL and PKCE code_verifier on the server.
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const rateLimited = checkRateLimit(`auth:${ip}`, RATE_LIMITS.AUTH)
  if (rateLimited) return rateLimited

  const origin = new URL(request.url).origin
  const cookieStore = await cookies()

  let responseCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      skipBrowserRedirect: true,
    },
  })

  if (error || !data.url) {
    console.error('[Auth Login] Google OAuth error:', error?.message)
    return NextResponse.redirect(
      `${origin}/?error=oauth_init_failed`
    )
  }

  const response = NextResponse.redirect(data.url)
  responseCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  return response
}
