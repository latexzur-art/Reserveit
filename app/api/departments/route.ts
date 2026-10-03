import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { cacheGetAsync, cacheSetAsync } from '@/lib/cache'

export const dynamic = 'force-dynamic'

const DEPARTMENTS_CACHE_KEY = 'ref:departments:all'
const TTL_1H = 60 * 60 * 1000

export async function GET() {
  const { user } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cached = await cacheGetAsync<any[]>(DEPARTMENTS_CACHE_KEY)
  if (cached !== undefined) {
    return NextResponse.json(
      { departments: cached },
      { headers: { 'Cache-Control': 'private, max-age=600' } }
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('departments')
    .select('id, code, name')
    .eq('is_active', true)
    .order('code')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const departments = data ?? []
  await cacheSetAsync(DEPARTMENTS_CACHE_KEY, departments, TTL_1H)

  return NextResponse.json(
    { departments },
    { headers: { 'Cache-Control': 'private, max-age=600' } }
  )
}

