import { NextRequest, NextResponse } from 'next/server'
import { requireBuildingAdminStrict } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { error } = await requireBuildingAdminStrict()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const supabase = createAdminClient()

    let query = supabase
      .from('users')
      .select('id, full_name, email')
      .eq('account_status', 'active')
      .order('full_name', { ascending: true })
      .limit(100)

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error: dbError } = await query
    if (dbError) throw new Error(dbError.message)

    const users = (data ?? []).map(u => ({
      id: u.id,
      name: u.full_name || u.email || 'Unknown',
    }))

    return NextResponse.json({ users })
  } catch (err: any) {
    console.error('[API] GET /admin/building/users-list error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
