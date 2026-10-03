/**
 * POST /api/schedules/history/rollback
 * Soft-rollback an array of class_schedules back to draft state.
 * Sets is_active = false (keeps the row as a rolled-back record).
 * Resets the corresponding staging entries to pending_review.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'

export async function POST(request: NextRequest) {
    const { error: authError, user } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

    const supabase = createAdminClient()

    try {
        const body = await request.json()
        const { scheduleIds } = body

        if (!scheduleIds || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
            return NextResponse.json({ error: 'Schedule IDs are required' }, { status: 400 })
        }

        // Fetch schedules to get their original staging entries + upload info for notification
        const { data: schedules, error: fetchErr } = await supabase
            .from('class_schedules')
            .select('id, staging_entry_id, schedule_upload_id')
            .in('id', scheduleIds)
            .eq('is_active', true)

        if (fetchErr) throw fetchErr

        if (!schedules || schedules.length === 0) {
            return NextResponse.json({ error: 'No active schedules found' }, { status: 404 })
        }

        const stagingIds = schedules.map(s => s.staging_entry_id).filter(Boolean)

        // Soft-delete: deactivate the class_schedule rows
        const { error: deactivateErr } = await supabase
            .from('class_schedules')
            .update({
                is_active: false,
                superseded_at: new Date().toISOString(),
                supersede_reason: 'Rolled back to draft',
            })
            .in('id', scheduleIds)

        if (deactivateErr) throw deactivateErr

        // Reset staging entries to draft
        if (stagingIds.length > 0) {
            const { error: stageErr } = await supabase
                .from('schedule_entries_staging')
                .update({
                    is_published: false,
                    academic_head_review_status: 'pending_review',
                    academic_head_review_notes: 'Rolled back from class schedules to Drafts',
                })
                .in('id', stagingIds)

            if (stageErr) throw stageErr
        }

        // Notify each program head whose upload was affected
        const uploadIds = [...new Set(schedules.map((s: any) => s.schedule_upload_id).filter(Boolean))]
        for (const uploadId of uploadIds) {
            const { data: uploadInfo } = await supabase
                .from('schedule_uploads')
                .select('uploaded_by, academic_term, departments!department_id(name)')
                .eq('id', uploadId)
                .single()
            if (uploadInfo?.uploaded_by) {
                const deptName = (uploadInfo as any).departments?.name ?? null
                const affectedCount = schedules.filter((s: any) => s.schedule_upload_id === uploadId).length
                sendNotification(supabase, {
                    user_id: uploadInfo.uploaded_by,
                    title: 'Schedule Entries Rolled Back',
                    message: `${affectedCount} schedule entr${affectedCount === 1 ? 'y' : 'ies'} were rolled back to draft by ${user.full_name}. Please review and resubmit.`,
                    type: 'warning',
                    source_type: 'schedule_upload',
                    source_id: String(uploadId),
                    priority: 'high',
                    metadata: {
                        upload_id: uploadId,
                        entries_rolled_back: affectedCount,
                        department: deptName,
                        academic_term: uploadInfo.academic_term ?? null,
                        decided_by_name: user.full_name,
                        status_to: 'partially_approved',
                    },
                }).catch(console.error)
            }
        }

        return NextResponse.json({ success: true, count: schedules.length })
    } catch (error: any) {
        console.error('History API Rollback error:', error)
        return NextResponse.json({ error: error.message || 'Failed to rollback schedules' }, { status: 500 })
    }
}
