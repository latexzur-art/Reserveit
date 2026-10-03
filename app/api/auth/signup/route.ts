import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { isInternalEmail } from '@/backend/auth/auth.utils'
import { AUTH_ERRORS } from '@/backend/auth/auth.constants'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { email, password, fullName } = await request.json()

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'Full name, email, and password are required.' }, { status: 400 })
  }

  if (isInternalEmail(email)) {
    return NextResponse.json({ error: AUTH_ERRORS.STI_EMAIL_NOT_ALLOWED }, { status: 400 })
  }

  const origin = request.headers.get('origin') ?? ''
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

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    // Supabase commits the auth.users row before sending the confirmation email.
    // If SMTP fails, the orphan blocks future re-signups with the same address.
    const isEmailFailure =
      error.status === 500 ||
      /confirmation email|sending.*email/i.test(error.message ?? '')

    if (isEmailFailure) {
      try {
        const admin = createAdminClient()
        const { data: orphan } = await admin
          .from('users')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        if (orphan) {
          await admin.auth.admin.deleteUser(orphan.id)
          // public.users.id is not FK-cascaded from auth.users — delete explicitly.
          await admin.from('users').delete().eq('id', orphan.id)
        }
      } catch (cleanupErr) {
        console.error('[signup] orphan cleanup failed:', cleanupErr)
      }
    }

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const response = NextResponse.json({ success: true })
  responseCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  })
  return response
}
