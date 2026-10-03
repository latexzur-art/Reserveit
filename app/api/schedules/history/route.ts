import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/schedules/history
 * Fetch all schedule uploads with joined department/user data
 */
export async function GET(request: Request) {
    try {
        const supabase = createAdminClient()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const departmentId = searchParams.get('department_id')

        let query = supabase
            .from('schedule_uploads')
            .select(`
        id, upload_mode, upload_status, source_file_name,
        total_entries, valid_entries_count, warning_entries_count,
        error_entries_count, conflict_count,
        submitted_at, reviewed_at, review_notes,
        created_at, updated_at,
        academic_term_id,
        departments(id, name, code),
        users!schedule_uploads_uploaded_by_fkey(id, full_name, email),
        academic_terms(id, term_name, academic_year)
      `)
            .order('created_at', { ascending: false })

        if (status) {
            query = query.eq('upload_status', status)
        }
        if (departmentId) {
            query = query.eq('department_id', departmentId)
        }

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ uploads: data ?? [] })
    } catch (error: any) {
        console.error('Error fetching schedule history:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
