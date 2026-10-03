import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { getFacilityAvailability } from '@/backend/booking'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error || !user) return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Required: date (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    // Only BA and AH see school event details; everyone else gets generic "Unavailable"
    const userRoles = (user.roles ?? []).map((r: { name: string }) => r.name)
    const isPrivileged = userRoles.includes('building_admin') || userRoles.includes('academic_head')
    const availability = await getFacilityAvailability(supabase, id, date, user.id, !isPrivileged)
    return NextResponse.json(availability)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] GET /facilities/[id]/availability error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
