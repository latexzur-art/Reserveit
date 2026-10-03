/**
 * POST /api/schedules/uploads  — Academic Head upload
 * Accepts CSV file upload, parses it, validates, and stages entries.
 * Also handles manual entry mode (JSON body without file).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuthenticatedInternal } from '@/lib/auth/guards'
import { validateAndEnrichEntry } from '@/backend/schedule/entryValidator'
import { RawCsvRow } from '@/backend/schedule/schedule.types'
import { findHeaderRowIndex, getFieldValue, mapColumns, formatValue, parseCompositeDays } from '@/backend/schedule/parserUtils'
import { detectAllConflicts } from '@/backend/schedule/conflictDetector'

export async function POST(request: NextRequest) {
    const { error: authError, user } = await requireAuthenticatedInternal()
    if (authError) return authError

    const roles = (user.roles ?? []).map((r: any) => r.name)
    const isProgramHead = roles.includes('program_head')
    const isAcademicHead = roles.includes('academic_head')
    const isBuildingAdmin = roles.includes('building_admin')
    // Program heads cannot pick a department — uploads are bound to their own.
    // Academic heads and building admins keep the override (cross-dept uploads).
    const canOverrideDepartment = isAcademicHead || isBuildingAdmin
    const callerDepartmentId = ((user as any).department?.id ?? (user as any).department_id ?? null) as string | null

    const supabase = createAdminClient()
    const contentType = request.headers.get('content-type') ?? ''

    // ── File Upload (multipart/form-data) ──────────────────
    if (contentType.includes('multipart/form-data')) {
        const form = await request.formData()
        const file = form.get('file') as File | null
        const termId = form.get('academic_term_id') as string | null
        const submittedDepartmentId = form.get('department_id') as string | null
        const departmentId = canOverrideDepartment ? submittedDepartmentId : callerDepartmentId
        if (!canOverrideDepartment && !callerDepartmentId) {
            return NextResponse.json({ error: 'Your account is not associated with a department' }, { status: 400 })
        }
        const effectiveStart = form.get('effective_start') as string | null
        const effectiveEnd = form.get('effective_end') as string | null
        const notes = form.get('notes') as string | null

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }
        if (!termId) {
            return NextResponse.json({ error: 'academic_term_id is required' }, { status: 400 })
        }

        let rows: any[] = []
        let headers: string[] = []

        // Check if file is Excel or CSV
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

        if (isExcel) {
            const buffer = await file.arrayBuffer()
            const ExcelJS = (await import('exceljs')).default
            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(buffer)
            const worksheet = workbook.worksheets[0]

            // Find header row (support branded templates)
            const allRows: any[][] = []
            worksheet.eachRow({ includeEmpty: true }, (row) => {
                const values = row.values as any[]
                allRows.push(values.slice(1)) // ExcelJS values are 1-indexed
            })

            const headerRowIndex = findHeaderRowIndex(allRows)
            headers = allRows[headerRowIndex].map(h => String(h || '').trim())

            for (let i = headerRowIndex + 1; i < allRows.length; i++) {
                const rowData = allRows[i]
                const hasContent = rowData.some(cell =>
                    cell !== null && cell !== undefined && String(cell).trim() !== ''
                )
                if (!hasContent) continue
                rows.push({ row_number: i + 1, __raw_array: rowData })
            }
        } else {
            // Read file content as text (CSV/TSV)
            const csvText = await file.text()
            const allLines = csvText.split(/\r?\n/).filter(l => l.trim())

            if (allLines.length === 0) {
                return NextResponse.json({ error: 'File is empty' }, { status: 400 })
            }

            const allRows = allLines.map(line => parseCSVLine(line))
            const headerRowIndex = findHeaderRowIndex(allRows)
            
            headers = allRows[headerRowIndex]
            const dataRows = allRows.slice(headerRowIndex + 1)
            
            rows = dataRows.map((dataRow, idx) => ({
                row_number: headerRowIndex + idx + 2,
                __raw_array: dataRow
            }))
        }

        // Create upload record
        let { data: upload, error: uploadErr } = await supabase
            .from('schedule_uploads')
            .insert({
                uploaded_by: user.id,
                academic_term_id: termId,
                department_id: departmentId,
                upload_mode: 'file_upload',
                upload_status: 'parsing',
                source_file_name: file.name,
                source_file_size: file.size,
                total_entries: rows.length,
                batch_effective_date: effectiveStart,
                batch_effective_end_date: effectiveEnd,
                notes: notes,
            })
            .select('id')
            .single()

        if (uploadErr) {
            if (uploadErr.message.includes('schedule_uploads_one_active_per_dept_term_idx')) {
                const deptId = departmentId ?? (user as any).department?.id
                // Auto-delete orphaned uploads to unblock the user
                if (deptId && termId) {
                    await supabase.from('schedule_uploads').delete()
                        .eq('department_id', deptId)
                        .eq('academic_term_id', termId)
                        .in('upload_status', ['validation_failed', 'pending_submission', 'parsing'])
                }

                // Check again to see if they are genuinely blocked by an active draft or pending review
                const { data: blocking } = deptId ? await supabase
                    .from('schedule_uploads')
                    .select('id')
                    .eq('department_id', deptId)
                    .eq('academic_term_id', termId!)
                    .in('upload_status', ['draft', 'pending_review', 'revision_requested'])
                    .limit(1)
                    .maybeSingle() : { data: null }

                if (blocking) {
                    return NextResponse.json(
                        { error: 'Your department already has an active schedule upload for this term. Complete or cancel it first.', blocking_upload_id: blocking.id },
                        { status: 409 }
                    )
                } else {
                    // Retry the insert since we cleared the orphaned ones
                    const { data: retryBatch, error: retryErr } = await supabase
                        .from('schedule_uploads')
                        .insert({
                            uploaded_by: user.id,
                            academic_term_id: termId,
                            department_id: departmentId,
                            upload_mode: 'file_upload',
                            upload_status: 'parsing',
                            source_file_name: file.name,
                            source_file_size: file.size,
                            total_entries: rows.length,
                            batch_effective_date: effectiveStart,
                            batch_effective_end_date: effectiveEnd,
                            notes: notes,
                        })
                        .select('id')
                        .single()
                    
                    if (retryErr) {
                        return NextResponse.json({ error: retryErr.message }, { status: 500 })
                    }
                    upload = retryBatch
                }
            } else {
                return NextResponse.json({ error: uploadErr.message }, { status: 500 })
            }
        }

        // Map columns using aliases
        const columnMap = mapColumns(headers)

        // Stage entries
        const initialRawRows: RawCsvRow[] = rows.map(row => {
            const arr = (row as any).__raw_array as any[]
            return {
                row_number: row.row_number,
                course_code: getFieldValue(arr, columnMap, 'course_code') || undefined,
                course_name: getFieldValue(arr, columnMap, 'course_name') || undefined,
                section: getFieldValue(arr, columnMap, 'section') || undefined,
                facility_name: getFieldValue(arr, columnMap, 'room') || undefined,
                instructor_name: getFieldValue(arr, columnMap, 'instructor') || undefined,
                session_type_raw: getFieldValue(arr, columnMap, 'session_type') || undefined,
                day_of_week_raw: getFieldValue(arr, columnMap, 'day') || undefined,
                start_time_raw: getFieldValue(arr, columnMap, 'start_time') || undefined,
                end_time_raw: getFieldValue(arr, columnMap, 'end_time') || undefined,
            }
        })

        // Forward-filling for blank continuation rows & Composite Day expansion
        const COMPOSITE_DAY_MAP: Record<string, string[]> = {
            mth: ['M', 'TH'],
            tf: ['T', 'F'],
            wf: ['W', 'F'],
            mwf: ['M', 'W', 'F'],
            tth: ['T', 'TH'],
            mw: ['M', 'W'],
        }

        const rawRows: RawCsvRow[] = []
        let lastCourseCode = ''
        let lastCourseName = ''
        let lastSection = ''
        let lastInstructorName = ''
        let lastFacilityName = ''

        for (const rawRow of initialRawRows) {
            const hasTimeOrDay = !!(rawRow.start_time_raw || rawRow.day_of_week_raw)

            if (rawRow.course_code) lastCourseCode = rawRow.course_code
            else if (hasTimeOrDay && lastCourseCode) rawRow.course_code = lastCourseCode

            if (rawRow.section) lastSection = rawRow.section
            else if (hasTimeOrDay && lastSection) rawRow.section = lastSection

            if (rawRow.course_name) lastCourseName = rawRow.course_name
            else if (hasTimeOrDay && lastCourseName) rawRow.course_name = lastCourseName

            if (rawRow.instructor_name) lastInstructorName = rawRow.instructor_name
            else if (hasTimeOrDay && lastInstructorName) rawRow.instructor_name = lastInstructorName

            if (rawRow.facility_name) lastFacilityName = rawRow.facility_name
            else if (hasTimeOrDay && lastFacilityName) rawRow.facility_name = lastFacilityName

            const compositeDays = parseCompositeDays(rawRow.day_of_week_raw || '')

            if (compositeDays.length > 1) {
                for (const singleDay of compositeDays) {
                    rawRows.push({
                        ...rawRow,
                        day_of_week_raw: singleDay,
                    })
                }
            } else {
                rawRows.push(rawRow)
            }
        }

        // Fetch strict instructor requirement setting
        const { data: settingRow } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'strict_instructor_requirement')
            .single()
        
        const strictInstructorRequirement = settingRow?.value === true

        const parsedEntries = []
        for (const raw of rawRows) {
            const entry = await validateAndEnrichEntry(supabase, raw, { strictInstructorRequirement })
            parsedEntries.push(entry)
        }

        // ── Duration Aggregation ──────────────────────────────────
        // If a course is split into multiple sessions (e.g., 2 sessions of 1.5h to meet a 3h requirement),
        // we should aggregate them before complaining about duration.
        try {
            const timeToMins = (t: string) => {
                const [h, m] = t.split(':').map(Number)
                return h * 60 + (m || 0)
            }

            const courseCodes = Array.from(new Set(parsedEntries.map(e => e.course_code).filter(Boolean)))
            const { data: coursesData } = await supabase
                .from('courses')
                .select('course_code, lecture_hours, lab_hours, delivery_mode')
                .in('course_code', courseCodes)

            const courseMap = new Map(coursesData?.map(c => [c.course_code, c]) || [])
            const groups: Record<string, { totalMins: number; expectedMins: number; entries: any[] }> = {}

            for (const entry of parsedEntries) {
                if (!entry.course_code || !entry.section || entry.validation_status === 'error') continue
                
                const course = courseMap.get(entry.course_code)
                if (!course) continue

                // Determine which expected hours to use based on session type
                const type = entry.session_type || (course.delivery_mode === 'lab' ? 'lab' : 'lecture')
                const expectedHours = type === 'lab' ? course.lab_hours : course.lecture_hours
                if (!expectedHours) continue

                const key = `${entry.course_code}|${entry.section}|${type}`
                if (!groups[key]) {
                    groups[key] = { totalMins: 0, expectedMins: expectedHours * 60, entries: [] }
                }

                const duration = timeToMins(entry.end_time) - timeToMins(entry.start_time)
                groups[key].totalMins += duration
                groups[key].entries.push(entry)
            }

            // Remove warnings for groups that meet the total requirement
            for (const key in groups) {
                const group = groups[key]
                if (group.totalMins >= group.expectedMins) {
                    for (const entry of group.entries) {
                        entry.validation_warnings = entry.validation_warnings.filter(
                            (w: any) => w.code !== 'DURATION_UNDER_HOURS'
                        )
                        // If there are no other warnings/errors, set status to valid
                        if (entry.validation_warnings.length === 0 && entry.validation_status === 'warning') {
                            entry.validation_status = 'valid'
                        }
                    }
                }
            }
        } catch (aggErr) {
            console.error('[Batch Duration Aggregation Error]:', aggErr)
            // Continue — non-critical enhancement
        }

        const entries = parsedEntries.map(entry => ({
            schedule_upload_id: upload!.id,
            entry_source: 'file_import',
            row_number: entry.row_number,
            facility_id: entry.facility_id,
            facility_name_raw: entry.facility_name_raw || '',
            facility_match_confidence: entry.facility_match_confidence,
            course_code: (entry.course_code || '').substring(0, 50),
            course_name: entry.course_name || entry.course_code || '',
            section: (entry.section || '').substring(0, 50),
            instructor_id: entry.instructor_id,
            instructor_name: entry.instructor_name || '',
            day_of_week: entry.day_of_week,
            start_time: entry.start_time || null,
            end_time: entry.end_time || null,
            effective_start_date: entry.effective_start_date || effectiveStart || null,
            effective_end_date: entry.effective_end_date || effectiveEnd || null,
            session_type: entry.session_type || null,
            validation_status: entry.validation_status,
            validation_errors: entry.validation_errors as unknown as any[],
            validation_warnings: entry.validation_warnings as unknown as any[],
            academic_head_review_status: 'pending_review',
        }))

        // Batch insert
        const { error: stageErr } = await supabase
            .from('schedule_entries_staging')
            .insert(entries)

        if (stageErr) {
            return NextResponse.json({ error: stageErr.message }, { status: 500 })
        }

        // Re-validate section overlaps (internal/external validation errors)


        // Run conflict detection on all staged entries
        const { conflict_count } = await detectAllConflicts(supabase, upload!.id)

        // Fetch actual counts from the DB to reflect section validation results
        const { data: dbEntries } = await supabase
            .from('schedule_entries_staging')
            .select('validation_status')
            .eq('schedule_upload_id', upload!.id)

        const validCount = dbEntries?.filter(e => e.validation_status === 'valid').length ?? 0
        const warningCount = dbEntries?.filter(e => e.validation_status === 'warning').length ?? 0
        const errorCount = dbEntries?.filter(e => e.validation_status === 'error').length ?? 0

        await supabase
            .from('schedule_uploads')
            .update({
                upload_status: 'pending_submission',
                valid_entries_count: validCount,
                warning_entries_count: warningCount,
                error_entries_count: errorCount,
                conflict_count,
            })
            .eq('id', upload!.id)

        return NextResponse.json({
            upload_id: upload!.id,
            entries_count: entries.length,
            columns_detected: columnMap,
            conflict_count,
        }, { status: 201 })
    }

    // ── Manual Entry (JSON body) ───────────────────────────
    const body = await request.json()
    const { academic_term_id, department_id: submittedManualDept, notes: manualNotes, entries: manualEntries } = body
    const manualDepartmentId = canOverrideDepartment ? (submittedManualDept ?? null) : callerDepartmentId

    if (!academic_term_id || !manualEntries?.length) {
        return NextResponse.json({ error: 'academic_term_id and entries are required' }, { status: 400 })
    }
    if (!canOverrideDepartment && !callerDepartmentId) {
        return NextResponse.json({ error: 'Your account is not associated with a department' }, { status: 400 })
    }

    // Create upload record
    let { data: upload, error: uploadErr } = await supabase
        .from('schedule_uploads')
        .insert({
            uploaded_by: user.id,
            academic_term_id,
            department_id: manualDepartmentId,
            upload_mode: 'manual_entry',
            upload_status: 'pending_submission',
            total_entries: manualEntries.length,
            notes: manualNotes || null,
        })
        .select('id')
        .single()

    if (uploadErr) {
        if (uploadErr.message.includes('schedule_uploads_one_active_per_dept_term_idx')) {
            const deptId = manualDepartmentId ?? (user as any).department?.id
            
            // Auto-delete orphaned uploads to unblock the user
            if (deptId && academic_term_id) {
                await supabase.from('schedule_uploads').delete()
                    .eq('department_id', deptId)
                    .eq('academic_term_id', academic_term_id)
                    .in('upload_status', ['validation_failed', 'pending_submission', 'parsing'])
            }

            // Check again for genuine blocking drafts
            const { data: blocking } = deptId ? await supabase
                .from('schedule_uploads')
                .select('id')
                .eq('department_id', deptId)
                .eq('academic_term_id', academic_term_id)
                .in('upload_status', ['draft', 'pending_review', 'revision_requested'])
                .limit(1)
                .maybeSingle() : { data: null }

            if (blocking) {
                return NextResponse.json(
                    { error: 'Your department already has an active schedule upload for this term. Complete or cancel it first.', blocking_upload_id: blocking.id },
                    { status: 409 }
                )
            } else {
                // Retry insert
                const { data: retryBatch, error: retryErr } = await supabase
                    .from('schedule_uploads')
                    .insert({
                        uploaded_by: user.id,
                        academic_term_id,
                        department_id: manualDepartmentId,
                        upload_mode: 'manual_entry',
                        upload_status: 'pending_submission',
                        total_entries: manualEntries.length,
                        notes: manualNotes || null,
                    })
                    .select('id')
                    .single()
                
                if (retryErr) {
                    return NextResponse.json({ error: retryErr.message }, { status: 500 })
                }
                upload = retryBatch
            }
        } else {
            return NextResponse.json({ error: uploadErr.message }, { status: 500 })
        }
    }

    const rawManualRows: RawCsvRow[] = manualEntries.map((e: any, idx: number) => ({
        row_number: idx + 1,
        course_code: e.course_code || undefined,
        course_name: e.course_name || undefined,
        section: e.section || undefined,
        facility_name: e.room || undefined,
        instructor_name: e.instructor || undefined,
        session_type_raw: e.session_type || undefined,
        day_of_week_raw: typeof e.day_of_week === 'number' ? String(e.day_of_week) : e.day || undefined,
        start_time_raw: e.start_time || undefined,
        end_time_raw: e.end_time || undefined,
        effective_start_date_raw: e.effective_start_date || undefined,
        effective_end_date_raw: e.effective_end_date || undefined,
    }))

    // Fetch strict instructor requirement setting
    const { data: manualSettingRow } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'strict_instructor_requirement')
        .single()
    
    const strictInstructorRequirement = manualSettingRow?.value === true

    const parsedManualEntries = []
    for (const raw of rawManualRows) {
        const entry = await validateAndEnrichEntry(supabase, raw, { strictInstructorRequirement })
        parsedManualEntries.push(entry)
    }

    const entries = parsedManualEntries.map((entry) => ({
        schedule_upload_id: upload!.id,
        entry_source: 'manual_entry',
        row_number: entry.row_number,
        facility_id: entry.facility_id,
        facility_name_raw: entry.facility_name_raw || '',
        facility_match_confidence: entry.facility_match_confidence,
        course_code: entry.course_code || '',
        course_name: entry.course_name || entry.course_code || '',
        section: entry.section || '',
        instructor_id: entry.instructor_id,
        instructor_name: entry.instructor_name || '',
        day_of_week: entry.day_of_week,
        start_time: entry.start_time || null,
        end_time: entry.end_time || null,
        effective_start_date: entry.effective_start_date || null,
        effective_end_date: entry.effective_end_date || null,
        session_type: entry.session_type || null,
        validation_status: entry.validation_status,
        validation_errors: entry.validation_errors as unknown as any[],
        validation_warnings: entry.validation_warnings as unknown as any[],
        academic_head_review_status: 'pending_review',
    }))

    const { error: stageErr } = await supabase
        .from('schedule_entries_staging')
        .insert(entries)

    if (stageErr) {
        return NextResponse.json({ error: stageErr.message }, { status: 500 })
    }

    // Re-validate section overlaps (internal/external validation errors)


    // Run conflict detection on all staged entries
    const { conflict_count } = await detectAllConflicts(supabase, upload!.id)

    // Fetch actual counts from the DB to reflect section validation results
    const { data: dbEntries } = await supabase
        .from('schedule_entries_staging')
        .select('validation_status')
        .eq('schedule_upload_id', upload!.id)

    const validManualCount = dbEntries?.filter(e => e.validation_status === 'valid').length ?? 0
    const warningManualCount = dbEntries?.filter(e => e.validation_status === 'warning').length ?? 0
    const errorManualCount = dbEntries?.filter(e => e.validation_status === 'error').length ?? 0

    await supabase
        .from('schedule_uploads')
        .update({
            upload_status: 'pending_submission',
            valid_entries_count: validManualCount,
            warning_entries_count: warningManualCount,
            error_entries_count: errorManualCount,
            conflict_count,
        })
        .eq('id', upload!.id)

    return NextResponse.json({
        upload_id: upload!.id,
        entries_count: entries.length,
        conflict_count,
    }, { status: 201 })
}

// ── Helpers ──────────────────────────────────────────────

function getField(row: Record<string, string | number>, columnMap: Record<string, number>, field: string): string {
    const idx = columnMap[field]
    if (idx === undefined) return ''
    const keys = Object.keys(row).filter(k => k !== 'row_number')
    const value = row[keys[idx]]
    return typeof value === 'string' ? value : ''
}

function parseCSVLine(line: string): string[] {
    // Detect delimiter: tab or comma (pick the one that splits the line into more parts)
    const tabs = (line.match(/\t/g) || []).length
    const commas = (line.match(/,/g) || []).length
    const delimiter = tabs >= commas && tabs > 0 ? '\t' : ','
    
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (const char of line) {
        if (char === '"') {
            inQuotes = !inQuotes
        } else if (char === delimiter && !inQuotes) {
            result.push(current.trim())
            current = ''
        } else {
            current += char
        }
    }
    result.push(current.trim())
    return result
}

const DAY_MAP: Record<string, number> = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1, m: 1,
    tue: 2, tuesday: 2, tu: 2, t: 2,
    wed: 3, wednesday: 3, w: 3,
    thu: 4, thursday: 4, th: 4, r: 4,
    fri: 5, friday: 5, f: 5,
    sat: 6, saturday: 6, s: 6,
}

function parseDayOfWeek(raw: string): number {
    const lower = raw.toLowerCase().trim()
    return DAY_MAP[lower] ?? -1
}

function parseTimeValue(raw: string): string {
    const trimmed = raw.trim().toUpperCase()
    // HH:MM format
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) return trimmed.padStart(5, '0')
    // HH:MM AM/PM
    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (match) {
        let h = parseInt(match[1])
        const m = match[2]
        const period = match[3].toUpperCase()
        if (period === 'PM' && h < 12) h += 12
        if (period === 'AM' && h === 12) h = 0
        return `${String(h).padStart(2, '0')}:${m}`
    }
    return raw.trim()
}
