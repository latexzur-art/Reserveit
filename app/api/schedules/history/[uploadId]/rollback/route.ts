import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { sendNotification } from '@/backend/booking/autoDecisionRouter'

/**
 * POST /api/schedules/history/[uploadId]/rollback
 * Rollback: deactivate all class_schedules from this upload
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ uploadId: string }> }
) {
    const { error: authError, user } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

    try {
        const supabase = createAdminClient()
        const { uploadId } = await params

        // Fetch upload info before modifying
        const { data: uploadInfo } = await supabase
            .from('schedule_uploads')
            .select('uploaded_by, academic_term, departments!department_id(name)')
            .eq('id', uploadId)
            .single()

        // Deactivate all schedules from this upload
        const { data: deactivated, error: schedError } = await supabase
            .from('class_schedules')
            .update({
                is_active: false,
                superseded_at: new Date().toISOString(),
                supersede_reason: 'Rolled back by Academic Head',
            })
            .eq('schedule_upload_id', uploadId)
            .eq('is_active', true)
            .select('id')

        if (schedError) throw schedError

        // Update upload status to reflect rollback
        const { error: uploadError } = await supabase
            .from('schedule_uploads')
            .update({
                upload_status: 'pending_submission',
                review_notes: 'Rolled back — please fix errors and republish',
            })
            .eq('id', uploadId)

        if (uploadError) throw uploadError

        // Unmark is_published on staging entries
        const { error: stagingError } = await supabase
            .from('schedule_entries_staging')
            .update({ is_published: false })
            .eq('schedule_upload_id', uploadId)
            .eq('is_published', true)

        if (stagingError) throw stagingError

        // Notify the program head
        if (uploadInfo?.uploaded_by) {
            const deptName = (uploadInfo as any).departments?.name ?? null
            sendNotification(supabase, {
                user_id: uploadInfo.uploaded_by,
                title: 'Schedule Rolled Back',
                message: `Your published schedule has been fully rolled back by ${user.full_name}. All entries have been deactivated. Please review, make corrections, and resubmit.`,
                type: 'warning',
                source_type: 'schedule_upload',
                source_id: uploadId,
                priority: 'high',
                metadata: {
                    upload_id: uploadId,
                    entries_rolled_back: deactivated?.length ?? 0,
                    department: deptName,
                    academic_term: uploadInfo.academic_term ?? null,
                    decided_by_name: user.full_name,
                    status_to: 'pending_submission',
                },
            }).catch(console.error)
        }

        return NextResponse.json({
            success: true,
            deactivated_count: deactivated?.length ?? 0,
        })
    } catch (error: any) {
        console.error('Error rolling back upload:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
