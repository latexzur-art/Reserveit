import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireProgramHead } from '@/lib/auth/guards'
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error, user } = await requireProgramHead()
    if (error) return error

    const supabase = createAdminClient()
    const { id } = await params

    try {
        // Only allow deleting own pending events
        const { data: event, error: fetchError } = await supabase
            .from('bookings')
            .select('id, current_status, user_id')
            .eq('id', id)
            .eq('booking_type', 'school_event_block')
            .single()

        if (fetchError || !event) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }

        if (event.user_id !== user!.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (event.current_status !== 'pending') {
            return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 400 })
        }

        const { error: deleteError } = await supabase
            .from('bookings')
            .delete()
            .eq('id', id)

        if (deleteError) throw deleteError

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
