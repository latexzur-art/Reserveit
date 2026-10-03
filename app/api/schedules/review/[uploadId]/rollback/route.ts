/**
 * POST /api/schedules/review/[uploadId]/rollback
 * Soft-rollback selected staging entries (or all published) back to draft state.
 * Sets is_active = false on the corresponding class_schedule rows (keeps them as
 * rolled-back records visible in the Rolled Back tab).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ uploadId: string }> }
) {
    const { error: authError, user } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

    const { uploadId } = await params
    const supabase = createAdminClient()

    try {
        const body = await request.json()
        const { entryIds } = body

        if (!entryIds || !Array.isArray(entryIds)) {
            return NextResponse.json({ error: 'Entry IDs are required' }, { status: 400 })
        }

        // Get class_schedules matching these staging entries
        const { data: schedules, error: schedErr } = await supabase
            .from('class_schedules')
            .select('id, staging_entry_id')
            .in('staging_entry_id', entryIds)
            .eq('schedule_upload_id', uploadId)
            .eq('is_active', true)

        if (schedErr) throw schedErr

        if (!schedules || schedules.length === 0) {
            return NextResponse.json({ error: 'No active schedules found for these entries' }, { status: 404 })
        }

        const scheduleIds = schedules.map(s => s.id)

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

        // Update staging entries: revert published flag and status
        const { error: stageErr } = await supabase
            .from('schedule_entries_staging')
            .update({
                is_published: false,
                academic_head_review_status: 'pending_review',
                academic_head_review_notes: 'Rollback from live schedules',
            })
            .in('id', entryIds)

        if (stageErr) throw stageErr

        // Downgrade upload status from 'approved' to 'partially_approved' if needed
        const { data: currentUpload } = await supabase
            .from('schedule_uploads')
            .select('upload_status')
            .eq('id', uploadId)
            .single()

        if (currentUpload?.upload_status === 'approved') {
            await supabase
                .from('schedule_uploads')
                .update({ upload_status: 'partially_approved' })
                .eq('id', uploadId)
        }

        // Notify the program head
        const { data: uploadFull } = await supabase
            .from('schedule_uploads')
            .select('uploaded_by, academic_term, departments!department_id(name)')
            .eq('id', uploadId)
            .single()

        if (uploadFull?.uploaded_by) {
            const deptName = (uploadFull as any).departments?.name ?? null
            sendNotification(supabase, {
                user_id: uploadFull.uploaded_by,
                title: 'Schedule Entries Rolled Back',
                message: `${schedules.length} schedule entr${schedules.length === 1 ? 'y' : 'ies'} from your upload were rolled back to draft by ${user.full_name}. Please review and resubmit.`,
                type: 'warning',
                source_type: 'schedule_upload',
                source_id: uploadId,
                priority: 'high',
                metadata: {
                    upload_id: uploadId,
                    entries_rolled_back: schedules.length,
                    department: deptName,
                    academic_term: uploadFull.academic_term ?? null,
                    decided_by_name: user.full_name,
                    status_to: 'partially_approved',
                },
            }).catch(console.error)
        }

        return NextResponse.json({ success: true, count: schedules.length })
    } catch (error: any) {
        console.error('Batch rollback error:', error)
        return NextResponse.json({ error: error.message || 'Failed to rollback entries' }, { status: 500 })
    }
}
