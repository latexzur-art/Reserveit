import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { getPendingBatches } from '@/backend/course'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('academic_head')) {
    return NextResponse.json({ error: 'Forbidden: Academic Head only' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const deptCode = searchParams.get('department_code') || undefined

  try {
    const supabase = createAdminClient()
    const batches = await getPendingBatches(supabase, deptCode)

    // Also fetch individual pending courses (not part of any batch)
    let query = supabase
      .from('courses')
      .select('*, profiles:created_by(full_name)')
      .in('approval_status', ['pending', 'sent_back'])
      .is('batch_upload_id', null)
      .order('created_at', { ascending: false })

    if (deptCode) query = query.eq('department_code', deptCode)

    const { data: individualCourses } = await query

    return NextResponse.json({
      batches,
      individualCourses: (individualCourses ?? []).map((c: any) => ({
        ...c,
        created_by_name: c.profiles?.full_name ?? 'Unknown',
        profiles: undefined,
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
