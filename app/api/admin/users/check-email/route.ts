import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUserManager } from '@/lib/auth/guards'
import { parseQuery } from '@/lib/api/validate'
import { apiUnexpectedError } from '@/lib/api/response'

const querySchema = z.object({ email: z.string().min(1, 'Email parameter is required') })

/**
 * GET /api/admin/users/check-email
 * Check if a user with the given email already exists
 */
export async function GET(request: NextRequest) {
  const { error } = await requireUserManager()
  if (error) return error

  const parsed = parseQuery(request, querySchema)
  if (!parsed.ok) return parsed.response

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('email', parsed.data.email.toLowerCase())
      .maybeSingle()

    return NextResponse.json({ exists: !!data })
  } catch (err) {
    return apiUnexpectedError('GET /api/admin/users/check-email', err)
  }
}
