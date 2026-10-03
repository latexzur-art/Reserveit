import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cacheGetAsync, cacheSetAsync } from '@/lib/cache'

/**
 * GET /api/academic-terms/active
 * Returns the currently active academic term (its date ranges + lifecycle windows).
 * Used by booking forms to constrain the date picker and surface the term banner.
 * Cached for 5 minutes (server-side); the term-management endpoints invalidate on change.
 */

type ActiveTermPublic = {
  id: string
  term_code: string
  term_name: string
  academic_year: string
  term_type: string
  start_date: string
  end_date: string
  enrollment_start: string | null
  enrollment_end: string | null
  exam_start: string | null
  exam_end: string | null
} | null

const CACHE_KEY = 'booking:active_term_public'
const TTL_5M = 5 * 60 * 1000

export async function GET() {
  const cached = await cacheGetAsync<ActiveTermPublic>(CACHE_KEY)
  if (cached !== undefined) {
    return NextResponse.json(
      { term: cached },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('academic_terms')
      .select('id, term_code, term_name, academic_year, term_type, start_date, end_date, enrollment_start, enrollment_end, exam_start, exam_end')
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.error('Error fetching active term:', error)
      return NextResponse.json({ term: null, error: error.message }, { status: 500 })
    }

    const term = (data as ActiveTermPublic) ?? null
    await cacheSetAsync(CACHE_KEY, term, TTL_5M)
    return NextResponse.json(
      { term },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (err: any) {
    console.error('Error fetching active term:', err)
    return NextResponse.json({ term: null, error: err.message }, { status: 500 })
  }
}

