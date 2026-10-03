import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

const VALID_TYPES = ['signup', 'magiclink', 'recovery', 'email_change'] as const
type OtpType = (typeof VALID_TYPES)[number]

function isValidType(value: unknown): value is OtpType {
  return typeof value === 'string' && (VALID_TYPES as readonly string[]).includes(value)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const tokenHash = body?.token_hash
  const type = body?.type

  if (typeof tokenHash !== 'string' || !isValidType(type)) {
    return NextResponse.json({ error: 'Missing or invalid token_hash / type' }, { status: 400 })
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

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

  if (error) {
    console.error('[verify-email] verifyOtp error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const response = NextResponse.json({ success: true, redirect: '/client/dashboard' })
  responseCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  })
  return response
}
