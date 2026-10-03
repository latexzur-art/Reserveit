/**
 * GET /api/faculty/availability — faculty + department + busy blocks for the
 * conflict-aware professor picker. Optional ?day_of_week=&start=&end=&department_id=
 * compute is_available for a specific slot. Guard: program head and up.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
import { getFacultyAvailability } from '@/backend/schedule/facultyAvailability'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireProgramHead()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const dow = searchParams.get('day_of_week')

  const supabase = createAdminClient()
  try {
    const faculty = await getFacultyAvailability(supabase, {
      dayOfWeek: dow != null ? parseInt(dow) : undefined,
      start: searchParams.get('start') ?? undefined,
      end: searchParams.get('end') ?? undefined,
      departmentId: searchParams.get('department_id') ?? undefined,
    })
    return NextResponse.json({ faculty })
  } catch (e: any) {
    console.error('[GET /api/faculty/availability]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
