import { SupabaseClient } from '@supabase/supabase-js'

export interface ScheduleUploadConflict {
  uploadId: string
  submittedAt: string | null
  submittedBy: string | null
  totalEntries: number | null
  departmentName: string | null
  termName: string | null
}

export async function resolveScheduleUploadConflict(
  supabase: SupabaseClient,
  departmentId: string | null,
  academicTermId: string | null,
): Promise<ScheduleUploadConflict | null> {
  if (!departmentId || !academicTermId) return null

  const { data } = await supabase
    .from('schedule_uploads')
    .select(`
      id,
      submitted_at,
      total_entries,
      users:uploaded_by ( full_name ),
      departments:department_id ( name ),
      academic_terms:academic_term_id ( term_name, academic_year )
    `)
    .eq('department_id', departmentId)
    .eq('academic_term_id', academicTermId)
    .not('upload_status', 'in', '(approved,rejected)')
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const userObj = Array.isArray((data as any).users)
    ? (data as any).users[0]
    : (data as any).users
  const deptObj = Array.isArray((data as any).departments)
    ? (data as any).departments[0]
    : (data as any).departments
  const termObj = Array.isArray((data as any).academic_terms)
    ? (data as any).academic_terms[0]
    : (data as any).academic_terms

  return {
    uploadId: (data as any).id,
    submittedAt: (data as any).submitted_at ?? null,
    submittedBy: userObj?.full_name ?? null,
    totalEntries: (data as any).total_entries ?? null,
    departmentName: deptObj?.name ?? null,
    termName: termObj
      ? `${termObj.term_name ?? ''}${termObj.academic_year ? ` (${termObj.academic_year})` : ''}`.trim()
      : null,
  }
}

export function duplicateScheduleUploadPayload(conflict: ScheduleUploadConflict | null) {
  const baseMessage = conflict?.departmentName && conflict?.termName
    ? `A schedule upload for ${conflict.departmentName} — ${conflict.termName} is already awaiting review.`
    : 'Your department already has an active schedule upload for this term. Complete or cancel it first.'

  return {
    error: 'DUPLICATE_PENDING_SCHEDULE_UPLOAD',
    message: baseMessage,
    blocking_upload_id: conflict?.uploadId ?? null,
    conflict,
  }
}
