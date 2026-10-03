/**
 * Course Upload Service
 * Handles batch upload operations (CSV/Excel/grid).
 * @module backend/course/courseUpload.service
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CourseUploadBatch, CourseCreateInput, UploadMode } from '@/types/course.types'
import { parseTemplateRow, validateBatch } from './courseValidation.service'
import { createCourseBatch, upsertCourseRows } from './course.service'
import { sendBrevoEmail } from '@/backend/notifications/brevoEmailService'
import { curriculumUploadPendingEmail, curriculumBatchDeletedEmail } from '@/backend/notifications/emailTemplates'
import { getAcademicHeadEmail } from '@/backend/notifications/recipientResolver'
import { sendNotificationToRoles } from '@/backend/booking/autoDecisionRouter'
import { NotificationService } from '@/backend/notifications/notification.service'

export async function createUploadBatch(
  supabase: SupabaseClient,
  deptId: string | null,
  termId: string | null,
  mode: UploadMode,
  userId: string,
  fileName?: string,
  fileType?: 'csv' | 'xlsx' | 'xls',
  uploaderNotes?: string,
  labelYearLevel?: number | null,
  labelTerm?: number | null
): Promise<CourseUploadBatch> {
  const { data, error } = await supabase
    .from('course_uploads')
    .insert({
      department_id: deptId || null,
      academic_term_id: termId,
      upload_mode: mode,
      upload_status: 'draft',
      uploaded_by: userId,
      source_file_name: fileName,
      source_file_type: fileType,
      uploader_notes: uploaderNotes || null,
      label_year_level: labelYearLevel ?? null,
      label_term: labelTerm ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create upload batch: ${error.message}`)
  return data
}

export async function parseCSVContent(
  content: string
): Promise<{ rows: ReturnType<typeof parseTemplateRow>[]; headers: string[] }> {
  const lines = content.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')

  // Find the header row — scan until we hit a line containing 'course_code'
  // This skips the Excel title banner row (row 1 in the template)
  let headerLineIdx = 0
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (lines[i].toLowerCase().includes('course_code')) {
      headerLineIdx = i
      break
    }
  }

  const headers = lines[headerLineIdx].split(',').map(h =>
    h.trim().toLowerCase().replace(/[*\s]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+$/g, '')
  )
  const rows = []

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const rowObj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx]?.trim() ?? ''
    })

    rows.push(parseTemplateRow(rowObj as any, i - headerLineIdx))
  }

  return { rows, headers }
}

export async function parseExcelContent(
  buffer: Buffer | ArrayBuffer
): Promise<{ rows: ReturnType<typeof parseTemplateRow>[]; headers: string[] }> {
  const ExcelJSModule = await import('exceljs')
  const ExcelJS = ExcelJSModule.default || ExcelJSModule
  const workbook = new ExcelJS.Workbook()
  try {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
    await workbook.xlsx.load(buf as any)
  } catch (err) {
    throw new Error(`Failed to load Excel file: ${err instanceof Error ? err.message : 'Invalid format'}`)
  }
  const worksheet = workbook.getWorksheet(1)
  if (!worksheet) throw new Error('Excel file is empty or has no worksheets')

  const rows: ReturnType<typeof parseTemplateRow>[] = []
  let headers: string[] = []
  let headerRowIdx = -1

  // Find the header row (skipping title banner)
  worksheet.eachRow((row, rowNumber) => {
    if (headerRowIdx !== -1) return
    const values = (row.values as any[]).map(v => String(v ?? '').toLowerCase())
    if (values.some(v => v.includes('course_code'))) {
      headerRowIdx = rowNumber
      headers = (row.values as any[]).slice(1).map(h =>
        String(h ?? '').trim().toLowerCase().replace(/[*\s]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+$/g, '')
      )
    }
  })

  if (headerRowIdx === -1) throw new Error('Excel must have a header row containing "course_code"')

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIdx) return
    const values = row.values as any[]
    const rowObj: Record<string, any> = {}
    headers.forEach((h, idx) => {
      // ExcelJS row.values is 1-indexed, first element is null/empty
      const val = values[idx + 1]
      rowObj[h] = val === undefined || val === null ? '' : val
    })
    // Skip blank rows and template footer/notes rows (course_code must start with a letter or digit)
    const cc = String(rowObj.course_code ?? '').trim()
    if (!cc || !/^[A-Za-z0-9]/i.test(cc)) return
    rows.push(parseTemplateRow(rowObj as any, rowNumber - headerRowIdx))
  })

  return { rows, headers }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

export async function validateAndPreviewBatch(
  supabase: SupabaseClient,
  _batchId: string,
  parsedInputs: CourseCreateInput[],
  opts?: { labelYearLevel?: number | null; labelTerm?: number | null }
): Promise<{
  validRows: CourseCreateInput[]
  results: Awaited<ReturnType<typeof validateBatch>>['results']
  hasErrors: boolean
}> {
  const { results, hasErrors } = await validateBatch(supabase, parsedInputs, opts)
  const validRows = parsedInputs.filter((_, i) => results[i]?.valid)
  return { validRows, results, hasErrors }
}

export async function commitBatch(
  supabase: SupabaseClient,
  batchId: string,
  validRows: CourseCreateInput[],
  userId: string
): Promise<{ coursesCreated: number }> {
  if (validRows.length === 0) throw new Error('No valid rows to commit')

  const courses = await createCourseBatch(supabase, validRows, batchId, userId)

  await supabase
    .from('course_uploads')
    .update({
      total_entries: courses.length,
      pending_count: courses.length,
      upload_status: 'pending_submission',
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)

  return { coursesCreated: courses.length }
}

export async function commitBatchAll(
  supabase: SupabaseClient,
  batchId: string,
  rows: CourseCreateInput[],
  results: { valid: boolean; errors: { field?: string; message: string }[]; warnings?: { message: string }[] }[],
  userId: string
): Promise<{ pendingCount: number; rejectedCount: number; skippedCount: number }> {
  if (rows.length === 0) throw new Error('No rows to commit')

  const inserts = rows.map((row, i) => {
    const result = results[i]
    const isValid = result?.valid ?? false
    return {
      ...row,
      approval_status: isValid ? ('pending' as const) : ('rejected' as const),
      rejection_reason: isValid
        ? (result?.warnings && result.warnings.length > 0 ? result.warnings.map(w => w.message).join('; ') : null)
        : (result?.errors?.map(e => e.message).join('; ') ?? 'Validation failed'),
      batch_upload_id: batchId,
      created_by: userId,
    }
  })

  // Rows identical to, or conflicting with, an existing course never touch the live row —
  // they're reported as rejected but excluded from any DB write and from the batch's counts
  // (they were never real entries in this batch to begin with).
  const isDuplicateConflict = (i: number) => results[i]?.errors?.some(e => e.field === 'duplicate_conflict') ?? false
  const isSkippedDuplicate = (i: number) =>
    isDuplicateConflict(i) || (results[i]?.errors?.some(e => e.field === 'duplicate_identical') ?? false)
  const writable = inserts.filter((_, i) => !isSkippedDuplicate(i))
  const hasBlockingConflicts = inserts.some((_, i) => isDuplicateConflict(i))

  // Classify writable rows as new vs. updating an existing row, for display counts only —
  // the write itself is a single atomic upsert regardless of this classification.
  const deptCodes = [...new Set(writable.map(r => r.department_code))]
  const courseCodes = [...new Set(writable.map(r => r.course_code))]
  const { data: existing } = deptCodes.length
    ? await supabase.from('courses').select('department_code, course_code').in('department_code', deptCodes).in('course_code', courseCodes)
    : { data: [] as { department_code: string; course_code: string }[] }

  const existingSet = new Set((existing ?? []).map(c => `${c.department_code}::${c.course_code}`))
  const updateRows = writable.filter(r => existingSet.has(`${r.department_code}::${r.course_code}`))
  const newRows = writable.filter(r => !existingSet.has(`${r.department_code}::${r.course_code}`))

  await upsertCourseRows(supabase, writable)

  const pendingCount = newRows.filter(r => r.approval_status === 'pending').length
  const rejectedCount = newRows.filter(r => r.approval_status === 'rejected').length

  // total_entries only counts rows that actually became (or updated) a real course row, so it
  // stays reconciled with pending/rejected/skipped — duplicate-skipped rows are reported
  // separately via validation_results, not folded into this batch's ongoing counts.
  await supabase
    .from('course_uploads')
    .update({
      total_entries: writable.length,
      pending_count: pendingCount,
      rejected_count: rejectedCount,
      upload_status: (rejectedCount > 0 || hasBlockingConflicts) ? 'validation_failed' : 'pending_submission',
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)

  return { pendingCount, rejectedCount, skippedCount: updateRows.length }
}

export async function submitBatch(
  supabase: SupabaseClient,
  batchId: string,
  userId: string
): Promise<void> {
  const { data: batch } = await supabase
    .from('course_uploads')
    .select('upload_status, total_entries, department_id, academic_term_id')
    .eq('id', batchId)
    .single()

  if (!batch) throw new Error('Upload batch not found')
  if (!['pending_submission', 'validation_failed', 'draft'].includes(batch.upload_status)) {
    throw new Error(`Cannot submit batch in status "${batch.upload_status}"`)
  }

  // Reset sent_back courses → pending so the academic head sees a clean review queue
  if (batch.upload_status === 'draft') {
    await supabase
      .from('courses')
      .update({ approval_status: 'pending', rejection_reason: null, updated_at: new Date().toISOString() })
      .eq('batch_upload_id', batchId)
      .eq('approval_status', 'sent_back')
  }

  // Duplicate detection: block if another submitted batch exists for same dept + term
  if (batch.department_id && batch.academic_term_id) {
    const { count: existingCount } = await supabase
      .from('course_uploads')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', batch.department_id)
      .eq('academic_term_id', batch.academic_term_id)
      .eq('upload_status', 'submitted')
      .neq('id', batchId)

    if ((existingCount ?? 0) > 0) {
      throw new Error(
        'A curriculum batch for this department and term is already awaiting review. Please wait for it to be processed before submitting another.'
      )
    }
  }

  await supabase
    .from('course_uploads')
    .update({
      upload_status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId)

  // Update all linked courses to pending
  await supabase
    .from('courses')
    .update({ approval_status: 'pending', updated_at: new Date().toISOString() })
    .eq('batch_upload_id', batchId)

  // Send email notification to Academic Head (fire-and-forget)
  const [{ data: uploadData }, { data: uploaderData }] = await Promise.all([
    supabase
      .from('course_uploads')
      .select(`
        submitted_at,
        total_entries,
        departments!department_id(name),
        academic_terms!academic_term_id(term_name)
      `)
      .eq('id', batchId)
      .single(),
    supabase.from('users').select('full_name').eq('id', userId).single(),
  ])

  if (uploadData) {
    const depts = uploadData.departments as { name: string } | Array<{ name: string }> | null
    const terms = uploadData.academic_terms as { term_name: string } | Array<{ term_name: string }> | null
    const departmentName = (Array.isArray(depts) ? depts[0]?.name : depts?.name) ?? 'Unknown Department'
    const termName = (Array.isArray(terms) ? terms[0]?.term_name : terms?.term_name) ?? 'Unknown Term'

    const emailPayload = curriculumUploadPendingEmail({
      uploadId: batchId,
      departmentName,
      termName,
      totalEntries: uploadData.total_entries ?? batch.total_entries ?? 0,
      uploadedByName: uploaderData?.full_name ?? 'Unknown',
      submittedAt: new Date(uploadData.submitted_at ?? Date.now()).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }),
      reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL}/academic/curriculum/approval-queue`,
    })

    try {
      const academicHeadEmail = await getAcademicHeadEmail()
      if (academicHeadEmail) {
        await sendBrevoEmail({ to: academicHeadEmail, subject: emailPayload.subject, htmlBody: emailPayload.htmlBody })
      } else {
        console.warn('[courseUpload] Upload email skipped — no active Academic Head found')
      }

      // In-app notification to academic heads
      await sendNotificationToRoles(supabase, ['academic_head'], {
        title: 'New Curriculum Submission Awaiting Review',
        message: `${uploaderData?.full_name ?? 'A program head'} submitted a curriculum batch for ${departmentName} — ${termName} (${uploadData.total_entries ?? 0} courses). Please review in the approval queue.`,
        type: 'info',
        source_type: 'course_upload',
        source_id: batchId,
        priority: 'normal',
        action_url: '/academic/curriculum/approval-queue',
        metadata: {
          batch_id: batchId,
          department: departmentName,
          academic_term: termName,
          total_entries: uploadData.total_entries ?? 0,
          submitted_by: uploaderData?.full_name ?? 'Unknown',
        },
      })
    } catch (err) {
      console.error('[courseUpload] Submitted notification failed:', err)
    }
  }
}

export async function getUploadHistory(
  supabase: SupabaseClient,
  opts: { deptId?: string; userId?: string; page?: number; limit?: number }
): Promise<{ uploads: any[]; total: number }> {
  const page = opts.page ?? 1
  const limit = Math.min(opts.limit ?? 20, 50)
  const offset = (page - 1) * limit

  let query = supabase
    .from('course_uploads')
    .select(`
      *,
      department:departments(code, name),
      uploader:users!course_uploads_uploaded_by_fkey(
        full_name,
        user_roles!user_roles_user_id_fkey(
          roles(name)
        )
      )
    `, { count: 'exact' })
    .neq('upload_status', 'deleted')

  if (opts.deptId) query = query.eq('department_id', opts.deptId)
  if (opts.userId) query = query.eq('uploaded_by', opts.userId)

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(`Failed to fetch upload history: ${error.message}`)
  
  const processedUploads = (data ?? []).map((u: any) => {
    const uploader = u.uploader || {}
    const roles = (uploader.user_roles ?? []).map((ur: any) => ur.roles?.name).filter(Boolean)
    const isAcademicHead = roles.includes('academic_head')
    const isProgramHead = roles.includes('program_head')
    const primaryRole = isAcademicHead ? 'Academic Head' : (isProgramHead ? 'Program Head' : roles[0] || 'User')
    return {
      ...u,
      department_name: u.department?.name ?? null,
      department_code: u.department?.code ?? (u.department_id ? '—' : 'Mixed'),
      uploader_name: uploader.full_name ?? 'Unknown',
      uploader_role: primaryRole,
    }
  })

  return { uploads: processedUploads, total: count ?? 0 }
}

export async function deleteUploadBatch(
  supabase: SupabaseClient,
  batchId: string,
  userId: string,
  isAcademicHead: boolean
): Promise<void> {
  const { data: batch } = await supabase
    .from('course_uploads')
    .select('id, upload_status, uploaded_by, department_id, academic_term_id, total_entries, uploader_notes, created_at, department:departments(name, code)')
    .eq('id', batchId)
    .single()

  if (!batch) throw new Error('Batch not found')
  if (!isAcademicHead && batch.uploaded_by !== userId) throw new Error('Forbidden')

  const isRejected = ['rejected', 'validation_failed', 'partially_rejected'].includes(batch.upload_status)
  if (!isAcademicHead && !['draft', 'pending_submission'].includes(batch.upload_status) && !isRejected)
    throw new Error('Cannot delete a batch that has already been submitted')

  const { data: batchCourses } = await supabase
    .from('courses')
    .select('id, course_code, course_name, created_at, approval_status')
    .eq('batch_upload_id', batchId)

  const dept = batch.department as any
  await supabase.from('audit_logs').insert({
    actor_id: userId,
    action: 'delete_rejected_upload',
    target_type: 'course_upload',
    target_id: batchId,
    details: {
      message: isRejected
        ? 'A rejected curriculum upload batch was deleted by the uploader.'
        : 'A curriculum upload batch was deleted before submission.',
      status_before_delete: batch.upload_status,
      departmentName: dept?.name ?? null,
      departmentCode: dept?.code ?? null,
      academic_term_id: batch.academic_term_id,
      totalEntries: batch.total_entries,
      uploaderNotes: batch.uploader_notes || null,
      courses: (batchCourses ?? []).map((c: any) => ({ course_code: c.course_code, course_name: c.course_name })),
    }
  })

  const batchCreatedAt = new Date(batch.created_at).getTime()
  const toDeleteIds: string[] = []
  const toRevertIds: string[] = []

  if (batchCourses) {
    batchCourses.forEach((c: any) => {
      const courseCreatedAt = new Date(c.created_at).getTime()
      // If the course was created before this batch, it was an update
      if (courseCreatedAt < batchCreatedAt - 5000) {
        toRevertIds.push(c.id)
      } else {
        // If it was already approved in this batch, detach it instead of deleting
        if (c.approval_status === 'approved') {
          toRevertIds.push(c.id)
        } else {
          toDeleteIds.push(c.id)
        }
      }
    })
  }

  if (toRevertIds.length > 0) {
    // Revert updated/approved courses back to approved status and detach them from this batch
    await supabase
      .from('courses')
      .update({
        batch_upload_id: null,
        approval_status: 'approved',
        rejection_reason: null,
      })
      .in('id', toRevertIds)
  }

  if (toDeleteIds.length > 0) {
    // Delete newly created courses
    await supabase.from('courses').delete().in('id', toDeleteIds)
  }

  const isDraftOrFailed = ['draft', 'validation_failed'].includes(batch.upload_status)

  if (isDraftOrFailed) {
    // If it was never submitted (is a draft or failed validation), hard-delete it completely
    const { error } = await supabase.from('course_uploads').delete().eq('id', batchId)
    if (error) throw new Error(`Failed to hard-delete batch: ${error.message}`)
  } else {
    // Soft-delete: keep the upload row (status='deleted') so it stays visible in history/logs.
    // Clear review_notes too — it may hold a stale "[DELETE_REQUESTED]" marker, which the UI
    // uses (independent of upload_status) to keep showing the deletion-request banner/button.
    // Zero the counts too, since the courses backing them no longer exist.
    const { error } = await supabase.from('course_uploads').update({
      upload_status: 'deleted',
      review_notes: null,
      pending_count: 0,
      approved_count: 0,
      rejected_count: 0,
    }).eq('id', batchId)
    if (error) throw new Error(`Failed to delete batch: ${error.message}`)
  }

  // Notify the uploader when the Academic Head deletes someone else's batch
  // (e.g. acting on a program head's deletion request)
  if (isAcademicHead && batch.uploaded_by !== userId) {
    try {
      const [{ data: uploader }, { data: reviewer }] = await Promise.all([
        supabase.from('users').select('full_name, email, notification_email').eq('id', batch.uploaded_by).single(),
        supabase.from('users').select('full_name').eq('id', userId).single(),
      ])

      const departmentName = dept?.name ?? 'Unknown Department'
      const deletedAt = new Date().toLocaleString('en-PH', {
        timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
      })

      if (uploader?.email) {
        const { subject, htmlBody } = curriculumBatchDeletedEmail({
          submitterName: uploader.full_name ?? 'Program Head',
          departmentName,
          totalEntries: batch.total_entries ?? 0,
          deletedByName: reviewer?.full_name ?? 'Academic Head',
          deletedAt,
          dashboardUrl: '/program/curriculum',
        })
        await sendBrevoEmail({ to: uploader.notification_email ?? uploader.email, subject, htmlBody })
      }

      await NotificationService.create({
        user_id: batch.uploaded_by,
        title: 'Curriculum Batch Deleted',
        message: `Your ${departmentName} curriculum batch (${batch.total_entries ?? 0} courses) has been deleted by the Academic Head.`,
        type: 'warning',
        source_type: 'course_upload',
        source_id: batchId,
        priority: 'high',
        action_url: '/program/curriculum',
      })
    } catch (err) {
      console.error('[courseUpload] Delete notification failed:', err)
    }
  }
}

/**
 * Clear a user's own finished upload history.
 *
 * Hard-deletes the caller's batches that are in a terminal state
 * (approved, rejected, validation_failed, partially_rejected, deleted).
 * In-progress (draft/pending_submission) and in-review (submitted) batches
 * are left untouched. Approved courses are detached so they remain in the
 * catalog. A single summary audit log is written so the academic head can
 * see the clear action.
 */
export async function clearUploadHistory(
  supabase: SupabaseClient,
  userId: string
): Promise<{ cleared: number }> {
  const TERMINAL_STATUSES = ['approved', 'rejected', 'validation_failed', 'partially_rejected', 'deleted']

  const { data: batches, error: fetchError } = await supabase
    .from('course_uploads')
    .select('id, upload_status, total_entries, source_file_name, uploader_notes, department:departments(name, code)')
    .eq('uploaded_by', userId)
    .in('upload_status', TERMINAL_STATUSES)

  if (fetchError) throw new Error(`Failed to load history: ${fetchError.message}`)
  if (!batches || batches.length === 0) return { cleared: 0 }

  const batchIds = batches.map((b: any) => b.id)

  // Capture course contents for each batch before deletion
  const { data: allCourses } = await supabase
    .from('courses')
    .select('batch_upload_id, course_code, course_name')
    .in('batch_upload_id', batchIds)

  const coursesByBatch = new Map<string, { course_code: string; course_name: string }[]>()
  for (const c of (allCourses ?? []) as any[]) {
    const list = coursesByBatch.get(c.batch_upload_id) ?? []
    list.push({ course_code: c.course_code, course_name: c.course_name })
    coursesByBatch.set(c.batch_upload_id, list)
  }

  // Detach approved courses so they remain in the catalog
  await supabase.from('courses').update({ batch_upload_id: null }).in('batch_upload_id', batchIds).eq('approval_status', 'approved')
  // Delete remaining non-approved courses
  await supabase.from('courses').delete().in('batch_upload_id', batchIds)
  // Delete the upload rows
  const { error: deleteError } = await supabase.from('course_uploads').delete().in('id', batchIds)
  if (deleteError) throw new Error(`Failed to clear history: ${deleteError.message}`)

  await supabase.from('audit_logs').insert({
    actor_id: userId,
    action: 'upload_history_cleared',
    target_type: 'course_upload',
    target_id: null,
    details: {
      message: 'Program head cleared their curriculum upload history.',
      count: batchIds.length,
      batches: batches.map((b: any) => ({
        id: b.id,
        status: b.upload_status,
        fileName: b.source_file_name,
        totalEntries: b.total_entries,
        departmentName: b.department?.name ?? null,
        departmentCode: b.department?.code ?? null,
        uploaderNotes: b.uploader_notes || null,
        courses: coursesByBatch.get(b.id) ?? [],
      })),
    },
  })

  return { cleared: batchIds.length }
}

export async function generateExcelTemplate(deptCode?: string, deptName?: string, allDeptCodes?: string[]): Promise<Buffer> {
  const isMixed = !!allDeptCodes?.length
  // Dynamic import to avoid issues in edge runtimes
  const ExcelJSModule = await import('exceljs')
  const ExcelJS = ExcelJSModule.default || ExcelJSModule

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ReserveIT'
  const sheet = workbook.addWorksheet('Course Template', {
    views: [{ state: 'frozen', ySplit: 2 }],
  })

  // ── Brand colors ──────────────────────────────────────────────
  const NAVY   = '050d36' // STI Navy  (header bg)
  const BLUE   = '0072bc' // STI Blue  (title row)
  const YELLOW = 'F5CE5B' // AH Yellow (accent / required marker)
  const WHITE  = 'FFFFFF'
  const LIGHT  = 'EFF6FF' // alternating row tint

  const deptDisplay = deptCode ?? 'YOUR_DEPT'

  // ── Row 1: Title banner ────────────────────────────────────────
  sheet.mergeCells('A1:L1')
  const titleCell = sheet.getCell('A1')
  const deptLabel = isMixed ? 'Mixed Departments' : (deptName ? `${deptName} (${deptCode})` : 'All Departments')
  titleCell.value = `ReserveIT — Course Catalog Upload Template   |   ${deptLabel}`
  titleCell.font   = { name: 'Calibri', bold: true, size: 13, color: { argb: `FF${WHITE}` } }
  titleCell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BLUE}` } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 28

  // ── Row 2: Column headers ──────────────────────────────────────
  const columns = [
    { header: 'course_code *',       key: 'course_code',       width: 16 },
    { header: 'course_name *',       key: 'course_name',       width: 34 },
    { header: 'department_code *',   key: 'department_code',   width: 20 },
    { header: 'units *',             key: 'units',             width: 9  },
    { header: 'year_level *',        key: 'year_level',        width: 13 },
    { header: 'term *',              key: 'term',              width: 8  },
    { header: 'delivery_mode *',     key: 'delivery_mode',     width: 18 },
    { header: 'lecture_hours',       key: 'lecture_hours',     width: 16 },
    { header: 'lab_hours',           key: 'lab_hours',         width: 13 },
    { header: 'prerequisite_codes',  key: 'prerequisite_codes',width: 22 },
    { header: 'is_elective',         key: 'is_elective',       width: 14 },
    { header: 'elective_type',       key: 'elective_type',     width: 28 },
    { header: 'description',         key: 'description',       width: 36 },
  ]

  // Set column widths
  columns.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width
  })

  // Write header cells in row 2
  const headerRow = sheet.getRow(2)
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.header
    cell.font  = { name: 'Calibri', bold: true, size: 11, color: { argb: `FF${WHITE}` } }
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
    cell.border = {
      bottom: { style: 'medium', color: { argb: `FF${YELLOW}` } },
      right:  { style: 'thin',   color: { argb: 'FF334155' } },
    }
  })
  headerRow.height = 22

  // Note: elective_type is only required when is_elective = TRUE
  const electiveTypeColIdx = columns.findIndex(c => c.key === 'elective_type') + 1
  if (electiveTypeColIdx > 0) {
    headerRow.getCell(electiveTypeColIdx).note =
      'Required only when is_elective = TRUE. Free text — e.g. "Web Development", "AI & Machine Learning Track". Leave blank for non-electives.'
  }

  // ── Sample data rows ───────────────────────────────────────────
  const dc = isMixed ? '' : (deptCode ?? deptDisplay)
  const samples = [
    [`${dc}1003`, 'Introduction to Computing',    dc, 3, 1, 1, 'Lecture',     3, 0,         '',         'FALSE', '',                 'Fundamentals of computer science'],
    [`${dc}1004`, 'Computer Programming 1',        dc, 3, 1, 2, 'Lab/Lecture', 2, 3, `${dc}1003`, 'FALSE', '',                 'Introduction to procedural programming'],
    [`${dc}2001`, 'Web Development Elective',      dc, 3, 2, 1, 'Lecture',     3, 0,         '',         'TRUE',  'Web Development', 'Elective: building modern web applications'],
  ]

  const DATA_START_ROW = 3
  const DATA_END_ROW   = 102 // support up to 100 courses

  samples.forEach((rowData, ri) => {
    const row = sheet.addRow(rowData)
    row.height = 18
    const bg = ri % 2 === 0 ? WHITE : LIGHT
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bg}` } }
      cell.font = { name: 'Calibri', size: 11 }
      cell.alignment = { vertical: 'middle' }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }
    })
  })

  // ── Dropdowns: department_code (col C) ────────────────────────
  // Always add delivery_mode dropdown; add dept dropdown for mixed mode
  const deliveryFormula = '"Lecture,Lab,Lab/Lecture,Practicum"'
  for (let r = DATA_START_ROW; r <= DATA_END_ROW; r++) {
    // delivery_mode is column G (index 7)
    sheet.getCell(r, 7).dataValidation = {
      type: 'list',
      allowBlank: false,
      showErrorMessage: true,
      errorTitle: 'Invalid delivery mode',
      error: 'Choose: Lecture, Lab, Lab/Lecture, or Practicum',
      formulae: [deliveryFormula],
    }

    if (isMixed && allDeptCodes!.length) {
      // department_code is column C (index 3)
      sheet.getCell(r, 3).dataValidation = {
        type: 'list',
        allowBlank: false,
        showErrorMessage: true,
        errorTitle: 'Invalid department',
        error: `Choose a department from the list: ${allDeptCodes!.join(', ')}`,
        formulae: [`"${allDeptCodes!.join(',')}"`],
      }
    }
  }

  const buf = await workbook.xlsx.writeBuffer()
  return Buffer.from(buf)
}
