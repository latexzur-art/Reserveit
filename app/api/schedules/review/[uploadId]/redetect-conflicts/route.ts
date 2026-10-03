/**
 * POST /api/schedules/review/[uploadId]/redetect-conflicts
 * Re-runs conflict detection for every valid/warning entry in the upload.
 * Call this after bulk edits so stale conflict flags are cleared.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
import { detectAllConflicts } from '@/backend/schedule/conflictDetector'
import { revalidateUploadHours } from '@/backend/schedule/entryValidator'
import { updateUploadCounts } from '@/backend/schedule/uploadCountUpdater'

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ uploadId: string }> }
) {
    const { error: authError } = await requireProgramHead()
    if (authError) return authError

    const { uploadId } = await params
    const supabase = createAdminClient()

    // 1. Re-validate hours across sessions
    await revalidateUploadHours(supabase, uploadId)

    // 1.5. Re-validate section overlaps


    // 2. Re-detect conflicts
    const { conflict_count } = await detectAllConflicts(supabase, uploadId)

    // 3. Update summary counts in the upload record
    await updateUploadCounts(supabase, uploadId)

    return NextResponse.json({ success: true, conflict_count })
}
