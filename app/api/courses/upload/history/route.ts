import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { getUploadHistory } from '@/backend/course'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  const { searchParams } = new URL(request.url)

  try {
    const supabase = createAdminClient()
    const opts: Record<string, any> = {
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '20'),
    }

    // Program heads see only their own uploads
    if (roles.includes('program_head') && !roles.includes('academic_head')) {
      opts.userId = user.id
    } else if (searchParams.get('department_id')) {
      opts.deptId = searchParams.get('department_id')
    }

    const result = await getUploadHistory(supabase, opts)

    // Also fetch individually added courses (not part of any batch)
    let individualQuery = supabase
      .from('courses')
      .select('id, course_code, course_name, department_code, approval_status, created_at, created_by, profiles:created_by(full_name)', { count: 'exact' })
      .is('batch_upload_id', null)
      .order('created_at', { ascending: false })

    if (opts.userId) individualQuery = individualQuery.eq('created_by', opts.userId)

    const { data: individualCourses, count: individualTotal } = await individualQuery

    return NextResponse.json({
      ...result,
      uploads: result.uploads,
      individualCourses: (individualCourses ?? []).map((c: any) => ({
        ...c,
        created_by_name: c.profiles?.full_name ?? 'Unknown',
        profiles: undefined,
      })),
      individualTotal: individualTotal ?? 0,
    })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
