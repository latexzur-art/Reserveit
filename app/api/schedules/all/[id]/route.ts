import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'

/**
 * DELETE /api/schedules/all/[id]
 * Permanently removes a class_schedule row from the database.
 * Only allowed on inactive (soft-deleted) records.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  // Safety: only allow hard delete of inactive records
  const { data: existing, error: fetchErr } = await supabase
    .from('class_schedules')
    .select('id, is_active')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  if (existing.is_active) {
    return NextResponse.json(
      { error: 'Cannot permanently delete an active schedule. Deactivate it first.' },
      { status: 400 }
    )
  }

  const { error } = await supabase.from('class_schedules').delete().eq('id', id)

  if (error) {
    console.error('[DELETE /api/schedules/all/[id]]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
