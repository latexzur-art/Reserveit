import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedUser } from '@/lib/auth/guards'

const idSchema = z.uuid()

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuthenticatedUser()
  if (error) return error

  const { id: rawId } = await params
  const idCheck = idSchema.safeParse(rawId)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 })
  }
  const id = idCheck.data

  const supabase = createAdminClient()

  const { data, error: fetchError } = await supabase
    .from('bookings')
    .select('current_status, pipeline_processed_at, assigned_reviewer_role')
    .eq('id', id)
    .single()

  if (fetchError || !data) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Verify the booking belongs to the user (or user has admin roles)
  const { data: booking } = await supabase
    .from('bookings')
    .select('user_id')
    .eq('id', id)
    .single()

  const isOwner = booking?.user_id === user.id
  const isAdmin = user.roles?.some((r: { name: string }) =>
    ['academic_head', 'building_admin', 'admin', 'it_administrator'].includes(r.name)
  )

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(data)
}
