/**
 * DELETE /api/schedules/history/drafts/delete
 * Permanently delete staging entries stored as drafts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
export async function POST(request: NextRequest) {
    const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

    const supabase = createAdminClient()

    try {
        const body = await request.json()
        const { stagingIds } = body

        if (!stagingIds || !Array.isArray(stagingIds) || stagingIds.length === 0) {
            return NextResponse.json({ error: 'Staging IDs are required' }, { status: 400 })
        }

        const { error: delErr } = await supabase
            .from('schedule_entries_staging')
            .delete()
            .in('id', stagingIds)

        if (delErr) throw delErr

        return NextResponse.json({ success: true, count: stagingIds.length })
    } catch (error: any) {
        console.error('Draft Delete error:', error)
        return NextResponse.json({ error: error.message || 'Failed to delete drafts' }, { status: 500 })
    }
}
