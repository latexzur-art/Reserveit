import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'

/**
 * PATCH /api/schedules/all/bulk
 * Bulk soft-deactivate: set is_active = false on the given IDs.
 * Body: { ids: string[] }
 */
export async function PATCH(request: NextRequest) {
  const { user } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await request.json() as { ids: string[] }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error, count } = await supabase
    .from('class_schedules')
    .update({
      is_active: false,
      superseded_at: new Date().toISOString(),
      supersede_reason: 'Bulk deactivated by Academic Head',
    })
    .in('id', ids)
    .eq('is_active', true)

  if (error) {
    console.error('[PATCH /api/schedules/all/bulk]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, affected: count ?? ids.length })
}

/**
 * DELETE /api/schedules/all/bulk
 * Bulk permanent delete: remove rows for the given IDs.
 * Only deletes inactive records — active ones are skipped.
 * Body: { ids: string[] }
 */
export async function DELETE(request: NextRequest) {
  const { user } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await request.json() as { ids: string[] }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Only permanently delete inactive records
  const { error, count } = await supabase
    .from('class_schedules')
    .delete()
    .in('id', ids)
    .eq('is_active', false)

  if (error) {
    console.error('[DELETE /api/schedules/all/bulk]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, deleted: count ?? 0 })
}
