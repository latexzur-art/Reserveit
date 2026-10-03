/**
 * Course Approval — read-side queries.
 * @module backend/course/courseApproval.queries
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Course, BatchWithCourses } from '@/types/course.types'

export async function getPendingBatches(
  supabase: SupabaseClient,
  deptCode?: string
): Promise<BatchWithCourses[]> {
  let query = supabase
    .from('course_uploads')
    .select(`
      *,
      departments(code, name),
      users!course_uploads_uploaded_by_fkey(full_name)
    `)
    .eq('upload_status', 'submitted')
    .order('submitted_at', { ascending: true })

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch pending batches: ${error.message}`)

  const filtered = (data ?? []).filter(batch => {
    const dept = batch.departments as any
    return !deptCode || dept?.code === deptCode
  })

  if (filtered.length === 0) return []

  const batchIds = filtered.map(b => b.id)
  const { data: allCourses } = await supabase
    .from('courses')
    .select('*')
    .in('batch_upload_id', batchIds)
    .order('course_code')

  const coursesByBatch = new Map<string, Course[]>()
  for (const c of allCourses ?? []) {
    if (c.batch_upload_id) {
      const arr = coursesByBatch.get(c.batch_upload_id) ?? []
      arr.push(c)
      coursesByBatch.set(c.batch_upload_id, arr)
    }
  }

  return filtered.map(batch => ({
    ...batch,
    courses: coursesByBatch.get(batch.id) ?? [],
    department_name: (batch.departments as any)?.name,
    uploader_name: (batch.users as any)?.full_name,
  }))
}

export async function getBatchDetails(
  supabase: SupabaseClient,
  batchId: string
): Promise<BatchWithCourses | null> {
  const { data: batch, error } = await supabase
    .from('course_uploads')
    .select(`
      *,
      departments(code, name),
      users!course_uploads_uploaded_by_fkey(full_name)
    `)
    .eq('id', batchId)
    .single()

  if (error) return null

  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('batch_upload_id', batchId)
    .order('course_code')

  return {
    ...batch,
    courses: courses ?? [],
    department_name: (batch.departments as any)?.name,
    uploader_name: (batch.users as any)?.full_name,
  }
}
