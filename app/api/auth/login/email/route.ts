import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { isInternalEmail } from '@/backend/auth/auth.utils'
import { AUTH_ERRORS } from '@/backend/auth/auth.constants'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  if (isInternalEmail(email)) {
    return NextResponse.json({ error: AUTH_ERRORS.STI_EMAIL_NOT_ALLOWED }, { status: 400 })
  }

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
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  // Check account status
  const { data: userProfile } = await supabase.rpc('get_current_user_with_roles')

  if (userProfile?.account_status === 'suspended') {
    await supabase.auth.signOut()
    return NextResponse.json({ error: AUTH_ERRORS.ACCOUNT_SUSPENDED }, { status: 403 })
  }

  if (userProfile?.account_status === 'inactive') {
    await supabase.auth.signOut()
    return NextResponse.json({ error: AUTH_ERRORS.ACCOUNT_INACTIVE }, { status: 403 })
  }

  const response = NextResponse.json({ success: true })
  responseCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  })
  return response
}
