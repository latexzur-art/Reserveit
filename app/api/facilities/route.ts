import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sanitizeDbError } from '@/lib/errors'
import { cacheGetAsync, cacheSetAsync } from '@/lib/cache'

const DEFAULT_FACILITIES_KEY = 'ref:facilities:default'
const TTL_10M = 10 * 60 * 1000

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const showAll = searchParams.get('all') === 'true'
  const rentalOnly = searchParams.get('rental') === 'true'
  const isDefaultQuery = !showAll && !rentalOnly

  if (isDefaultQuery) {
    const cached = await cacheGetAsync<any>(DEFAULT_FACILITIES_KEY)
    if (cached !== undefined) {
      return NextResponse.json(
        { facilities: cached },
        { headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' } }
      )
    }
  }

  const supabase = createAdminClient()

  // Only admins can see all facilities (including inactive/maintenance)
  if (showAll) {
    const adminRoles = ['building_admin', 'academic_head', 'it_admin']
    const userRoles: string[] = (user.roles ?? []).map((r: { name: string }) => r.name)
    const isAdmin = userRoles.some((role: string) => adminRoles.includes(role))
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let query = supabase
    .from('facilities')
    .select(`
      id,
      name,
      room_number,
      capacity,
      status,
      code,
      is_available_for_rental,
      floors (
        floor_number,
        buildings ( name )
      ),
      facility_types ( name )
    `)
    .order('name')

  if (rentalOnly) {
    // Rental facilities may not be flagged is_bookable — only require active + rental flag
    query = query
      .eq('is_active', true)
      .eq('is_available_for_rental', true)
  } else if (!showAll) {
    query = query
      .eq('is_active', true)
      .eq('is_bookable', true)
      .eq('status', 'available')
  }

  const { data: facilities, error: dbError } = await query

  if (dbError) {
    return NextResponse.json({ error: sanitizeDbError(dbError) }, { status: 500 })
  }

  if (isDefaultQuery && facilities) {
    await cacheSetAsync(DEFAULT_FACILITIES_KEY, facilities, TTL_10M)
  }

  return NextResponse.json(
    { facilities: facilities ?? [] },
    { headers: isDefaultQuery ? { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' } : undefined }
  )
}
