import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireBuildingAdmin } from '@/lib/auth/guards'
import { handleBulkCancellation } from '@/backend/booking/cancellationHandler'

const BulkCancelSchema = z.object({
    booking_ids: z.array(z.string().uuid()).min(1),
    reason: z.string().min(1).max(1000),
    cancellation_type: z.enum(['admin_cancelled', 'facility_unavailable', 'force_majeure']).default('admin_cancelled'),
})

export async function POST(request: NextRequest) {
    const { error, user } = await requireBuildingAdmin()
    if (error) return error

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = BulkCancelSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
    }

    const { booking_ids, reason, cancellation_type } = parsed.data
    const supabase = createAdminClient()

    try {
        const result = await handleBulkCancellation(
            supabase,
            booking_ids,
            cancellation_type,
            user.id,
            reason
        )

        return NextResponse.json(result, { status: 200 })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[API] POST /api/admin/bookings/bulk-cancel error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
