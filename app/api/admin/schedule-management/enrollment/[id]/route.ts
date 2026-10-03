import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireAcademicHeadOrBuildingAdmin()
    if (error) return error

    const supabase = createAdminClient()
    const { id } = await params

    try {
        const { error: deleteError } = await supabase
            .from('facility_blocks')
            .delete()
            .eq('id', id)
            .eq('block_type', 'enrollment')

        if (deleteError) throw deleteError

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
