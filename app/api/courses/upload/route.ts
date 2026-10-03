import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUserWithRoles } from '@/lib/supabase/auth-helper'
import { createUploadBatch, parseCSVContent, parseExcelContent, validateAndPreviewBatch, commitBatchAll } from '@/backend/course/courseUpload.service'
import { getErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { user, error: authErr } = await getAuthUserWithRoles()
  if (!user) return NextResponse.json({ error: authErr ?? 'Unauthorized' }, { status: 401 })

  const roles = (user.roles ?? []).map((r: any) => r.name)
  if (!roles.includes('program_head') && !roles.includes('academic_head')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createAdminClient()
  let batchIdToCleanup: string | null = null

  try {
    const formData = await request.formData()
    const file          = formData.get('file') as File | null
    const deptId        = formData.get('department_id') as string | null
    const termId        = formData.get('academic_term_id') as string | null
    const mixed         = formData.get('mixed') === 'true'
    const uploaderNotes = formData.get('uploader_notes') as string | null
    const labelYearLevelRaw = formData.get('label_year_level') as string | null
    const labelTermRaw      = formData.get('label_term') as string | null
    const labelYearLevel = labelYearLevelRaw ? parseInt(labelYearLevelRaw, 10) : null
    const labelTerm      = labelTermRaw ? parseInt(labelTermRaw, 10) : null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!mixed && !deptId) return NextResponse.json({ error: 'department_id required' }, { status: 400 })

    const fileName = file.name.toLowerCase()
    const isExcel = fileName.endsWith('.xlsx')
    const isCsv = fileName.endsWith('.csv')

    if (!isExcel && !isCsv) {
      return NextResponse.json({ error: 'Only CSV and Excel (.xlsx) files are currently supported' }, { status: 400 })
    }

    let rows: any[] = []

    if (isCsv) {
      const content = await file.text()
      const parsed = await parseCSVContent(content)
      rows = parsed.rows
    } else {
      const buffer = Buffer.from(await file.arrayBuffer())
      const parsed = await parseExcelContent(buffer)
      rows = parsed.rows
    }

    // Create batch
    const fileType = isCsv ? 'csv' : 'xlsx'
    const batch = await createUploadBatch(supabase, deptId, termId, 'file_upload', user.id, file.name, fileType, uploaderNotes || undefined, labelYearLevel, labelTerm)
    batchIdToCleanup = batch.id

    // Track original row positions so we can map validation results back to all rows
    const validInputEntries: { originalIndex: number; input: any }[] = []
    rows.forEach((row: any, i: number) => {
      if (row.input !== null) validInputEntries.push({ originalIndex: i, input: row.input })
    })
    const validInputs = validInputEntries.map(e => e.input)
    const parseFailedCount = rows.length - validInputs.length

    if (validInputs.length === 0) {
      // Build per-row results for the error-only case
      const allRowResults = rows.map((row: any, i: number) => ({
        row: i + 1,
        valid: false,
        errors: row.errors ?? [],
        warnings: [],
      }))

      // Hard-delete the batch if parsing fails
      await supabase.from('course_uploads').delete().eq('id', batch.id)
      batchIdToCleanup = null

      return NextResponse.json({
        error: 'No valid rows found in CSV',
        batch_id: batch.id,
        total_rows: rows.length,
        valid_rows: 0,
        new_rows: 0,
        updated_rows: 0,
        rejected_rows: rows.length,
        validation_results: allRowResults,
        has_errors: true,
        status: 'validation_failed',
      }, { status: 400 })
    }

    // Validate all rows
    const preview = await validateAndPreviewBatch(supabase, batch.id, validInputs, { labelYearLevel, labelTerm })

    // Always commit all rows — invalid ones stored as 'rejected' with reason
    const { pendingCount, rejectedCount, skippedCount } = await commitBatchAll(
      supabase, batch.id, validInputs, preview.results, user.id
    )

    // Build unified per-row result covering ALL original rows (parse failures + validation results)
    const allRowResults = rows.map((row: any, i: number) => {
      if (row.input === null) {
        return { row: i + 1, course_code: null, valid: false, errors: row.errors ?? [], warnings: [] }
      }
      const validEntryIdx = validInputEntries.findIndex(e => e.originalIndex === i)
      const result = preview.results[validEntryIdx]
      return {
        row: i + 1,
        course_code: row.input.course_code,
        valid: result?.valid ?? false,
        errors: result?.errors ?? [],
        warnings: result?.warnings ?? [],
      }
    })

    // skippedCount = existing courses updated in-place (not errors)
    const hasErrors = preview.hasErrors || parseFailedCount > 0
    const totalValidRows = pendingCount + skippedCount
    const totalRejected = rejectedCount + parseFailedCount
    return NextResponse.json({
      batch_id: batch.id,
      total_rows: rows.length,
      valid_rows: totalValidRows,
      new_rows: pendingCount,
      updated_rows: skippedCount,
      rejected_rows: totalRejected,
      validation_results: allRowResults,
      has_errors: hasErrors,
      status: hasErrors ? 'validation_failed' : 'pending_submission',
    }, { status: 201 })
  } catch (err) {
    if (batchIdToCleanup) {
      await supabase.from('course_uploads').delete().eq('id', batchIdToCleanup)
    }
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
