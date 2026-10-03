import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
const DELETABLE_STATUSES = ['cancelled', 'overridden', 'completed', 'rejected', 'auto_declined', 'approved', 'auto_approved']

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const hasRole = user.roles?.some((r: { name: string }) => r.name === 'academic_head')
  if (!hasRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = BulkDeleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  const { ids } = parsed.data
  const supabase = createAdminClient()

  try {
    // First, find which bookings are actually deletable
    const { data: deletable, error: fetchError } = await supabase
      .from('bookings')
      .select('id')
      .in('id', ids)
      .in('current_status', DELETABLE_STATUSES)

    if (fetchError) throw fetchError

    const deletableIds = (deletable ?? []).map((b) => b.id)
    if (deletableIds.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 })
    }

    // Delete associated payment records first (payments has ON DELETE RESTRICT)
    const { error: paymentDeleteError } = await supabase
      .from('payments')
      .delete()
      .in('booking_id', deletableIds)

    if (paymentDeleteError) {
      console.error('[bulk-delete] Failed to delete payment records:', paymentDeleteError)
      throw paymentDeleteError
    }

    // Now delete the bookings themselves
    const { error: deleteError, count } = await supabase
      .from('bookings')
      .delete({ count: 'exact' })
      .in('id', deletableIds)

    if (deleteError) {
      console.error('[bulk-delete] Failed to delete bookings:', deleteError)
      throw deleteError
    }

    return NextResponse.json({ success: true, deleted: count ?? 0 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[bulk-delete] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

