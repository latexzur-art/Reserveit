import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'
const DELETABLE_STATUSES = ['cancelled', 'overridden', 'completed', 'rejected', 'auto_declined', 'approved', 'auto_approved']

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const hasRole = user.roles?.some((r: { name: string }) => r.name === 'academic_head')
  if (!hasRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: rawId } = await params
  const idParse = z.string().uuid().safeParse(rawId)
  if (!idParse.success) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 })
  }
  const id = idParse.data

  const supabase = createAdminClient()

  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, current_status, booking_reference')
    .eq('id', id)
    .single()

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (!DELETABLE_STATUSES.includes(booking.current_status)) {
    return NextResponse.json(
      { error: `Cannot delete an active booking (status: ${booking.current_status}). Cancel it first.` },
      { status: 400 }
    )
  }

  // Delete associated payment records first (payments has ON DELETE RESTRICT)
  await supabase.from('payments').delete().eq('booking_id', id)

  const { error: deleteError } = await supabase.from('bookings').delete().eq('id', id)
  if (deleteError) throw deleteError

  return NextResponse.json({ success: true, booking_reference: booking.booking_reference })
}
