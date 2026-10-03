import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cacheDeleteByPrefix } from '@/lib/cache'

/**
 * POST /api/admin/academic-terms/[id]/set-active
 * Set a term as the active term (deactivates all others)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient()
    const { id } = await params

    // Call the database function to set active term
    const { data, error } = await supabase.rpc('set_active_term', {
      p_term_id: id,
    })

    if (error) throw error

    // Bust every cached active-term shape (engine, hard-checker range, and the
    // public booking-form payload) so the change reflects immediately everywhere.
    cacheDeleteByPrefix('booking:active_term')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error setting active term:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
