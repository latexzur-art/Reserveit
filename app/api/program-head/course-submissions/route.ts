import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('program_head') && !roles.includes('academic_head')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('course_uploads')
      .select(`
        id,
        upload_mode,
        upload_status,
        source_file_name,
        total_entries,
        approved_count,
        rejected_count,
        pending_count,
        submitted_at,
        reviewed_at,
        review_notes,
        created_at,
        updated_at,
        departments ( name, code ),
        academic_terms ( name )
      `)
      .eq('uploaded_by', user.id)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const batches = (data ?? []).map((b: any) => ({
      id: b.id,
      upload_mode: b.upload_mode,
      upload_status: b.upload_status,
      source_file_name: b.source_file_name,
      total_entries: b.total_entries,
      approved_count: b.approved_count,
      rejected_count: b.rejected_count,
      pending_count: b.pending_count,
      submitted_at: b.submitted_at,
      reviewed_at: b.reviewed_at,
      review_notes: b.review_notes,
      created_at: b.created_at,
      updated_at: b.updated_at,
      department_name: b.departments?.name ?? null,
      department_code: b.departments?.code ?? null,
      term_name: b.academic_terms?.name ?? null,
    }))

    return NextResponse.json({ batches })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
