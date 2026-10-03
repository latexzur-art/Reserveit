import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimitAsync, RATE_LIMITS } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const rateLimited = await checkRateLimitAsync(`auth:${ip}`, RATE_LIMITS.AUTH)
  if (rateLimited) return rateLimited

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
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  // Get user profile with roles
  const { data: userProfile, error } = await supabase.rpc('get_current_user_with_roles')

  if (error || !userProfile) {
    return NextResponse.json({ user: null }, { status: 200 })
  }

  // RPC returns snake_case; AuthUser type expects camelCase
  const p = userProfile as Record<string, unknown>
  
  // The get_current_user_with_roles RPC doesn't return these newer columns
  const { data: userData } = await supabase.from('users').select('notification_email, gender, language, must_change_password').eq('id', p.id).single()

  const user = {
    id: p.id,
    authUserId: p.auth_user_id,
    email: p.email,
    fullName: p.full_name,
    userType: p.user_type,
    accountStatus: p.account_status,
    mustChangePassword: (p.must_change_password ?? userData?.must_change_password) ?? false,
    employeeId: p.employee_id,
    phone: p.phone as string | null,
    avatarUrl: p.avatar_url as string | null,
    notificationEmail: userData?.notification_email || null,
    gender: userData?.gender || null,
    language: userData?.language || null,
    emailVerified: p.email_verified as boolean,
    lastLoginAt: p.last_login_at,
    department: p.department,
    roles: p.roles,
  }

  return NextResponse.json(
    { user },
    { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=60' } }
  )
}
