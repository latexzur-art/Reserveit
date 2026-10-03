import { NextResponse, type NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'
import { getErrorMessage } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuthenticatedUser()
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const facilityId = searchParams.get('facility_id')

    const supabase = createAdminClient()
    let query = supabase
      .from('facility_warnings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (facilityId) {
      query = query.eq('facility_id', facilityId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const warnings = (data || []).map((row: any) => ({
      id: row.id,
      facilityId: row.facility_id,
      severity: row.severity,
      message: row.message,
      isActive: row.is_active,
      createdBy: row.created_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return NextResponse.json({ warnings })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
