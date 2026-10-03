import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/api/validate'
import { apiError } from '@/lib/api/response'
import { getErrorMessage } from '@/lib/errors'

const changePasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
  confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters long'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export async function POST(request: NextRequest) {
  const parsedBody = await parseBody(request, changePasswordSchema)
  if (!parsedBody.ok) return parsedBody.response
  const { newPassword } = parsedBody.data

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

  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) {
    return apiError(401, 'Unauthorized — please sign in to change password')
  }

  try {
    // 1. Update password in Supabase Auth
    const { error: authErr } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (authErr) {
      return NextResponse.json({ success: false, error: authErr.message }, { status: 400 })
    }

    // 2. Clear must_change_password flag in public.users
    const { error: dbErr } = await supabase
      .from('users')
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', user.id)

    if (dbErr) {
      console.error('[change-password] Failed to clear must_change_password flag:', dbErr)
    }

    return NextResponse.json({ success: true, redirectTo: '/client/dashboard' })
  } catch (err) {
    console.error('[API] POST /api/auth/change-password error:', err)
    return apiError(500, getErrorMessage(err))
  }
}
