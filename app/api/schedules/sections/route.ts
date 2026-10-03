import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { sanitizeDbError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/schedules/sections?courseCode=XYZ
 *
 * Returns distinct section labels previously used for the given course_code
 * (across class_schedules), most recently created first. Used to populate the
 * section typeahead in the manual schedule-entry dialog.
 */
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuthenticatedUser()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const courseCode = (searchParams.get('courseCode') ?? '').trim()
  if (!courseCode) return NextResponse.json({ sections: [] })

  const supabase = createAdminClient()

  const { data, error: dbError } = await supabase
    .from('class_schedules')
    .select('section, created_at')
    .eq('course_code', courseCode)
    .order('created_at', { ascending: false })
    .limit(500)

  if (dbError) {
    return NextResponse.json({ error: sanitizeDbError(dbError) }, { status: 500 })
  }

  const seen = new Set<string>()
  const sections: string[] = []
  for (const row of data ?? []) {
    const s = (row.section ?? '').trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    sections.push(s)
  }

  return NextResponse.json({ sections })
}
