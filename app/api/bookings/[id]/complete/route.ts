import { NextRequest, NextResponse } from 'next/server'
import { parseUuidParam } from '@/lib/api/validate-uuid'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdmin } from '@/lib/auth/guards'
import { handleCompletion } from '@/backend/booking'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireBuildingAdmin()
  if (error) return error

  const { id: __rawId } = await params
  const __idParsed = parseUuidParam(__rawId, 'booking id')
  if (!__idParsed.ok) return __idParsed.response
  const id = __idParsed.value

  try {
    const supabase = createAdminClient()
    const result = await handleCompletion(supabase, id, user.id)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[API] PATCH /bookings/[id]/complete error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
