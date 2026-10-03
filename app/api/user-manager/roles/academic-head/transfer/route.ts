import { NextRequest, NextResponse } from 'next/server'
import { requireUserManager } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireUserManager()
  if (authError) return authError

  let body: { from_user_id: string; to_user_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { from_user_id, to_user_id } = body

  if (!from_user_id || !to_user_id) {
    return NextResponse.json(
      { error: 'Both from_user_id and to_user_id are required' },
      { status: 400 }
    )
  }

  if (from_user_id === to_user_id) {
    return NextResponse.json(
      { error: 'from_user_id and to_user_id must be different users' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { error: transferError } = await supabase.rpc('transfer_academic_head', {
    from_user_id,
    to_user_id,
    assigned_by_id: user.id,
  })

  if (transferError) {
    const isConstraintError = transferError.message?.includes('Only one active Academic Head')
    return NextResponse.json(
      {
        error: isConstraintError
          ? transferError.message
          : 'Transfer failed — database error',
        details: transferError.message,
      },
      { status: isConstraintError ? 409 : 500 }
    )
  }

  const { data: newHolder } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('id', to_user_id)
    .single()

  return NextResponse.json({
    success: true,
    message: 'Academic Head role transferred successfully',
    new_academic_head: newHolder ?? { id: to_user_id },
  })
}
