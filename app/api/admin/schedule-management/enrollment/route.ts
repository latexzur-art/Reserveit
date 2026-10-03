import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
export async function GET(request: NextRequest) {
    const { error } = await requireAcademicHeadOrBuildingAdmin()
    if (error) return error

    const supabase = createAdminClient()

    try {
        const { data: blocks, error: dbError } = await supabase
            .from('facility_blocks')
            .select(`
        id,
        facility_id,
        block_type,
        start_time,
        end_time,
        reason,
        created_at,
        facilities ( name )
      `)
            .eq('block_type', 'enrollment')
            .order('start_time', { ascending: true })

        if (dbError) throw dbError

        return NextResponse.json({ blocks })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const { error, user } = await requireAcademicHeadOrBuildingAdmin()
    if (error) return error

    const supabase = createAdminClient()

    try {
        const body = await request.json()
        const { facility_ids, start_time, end_time, reason } = body

        if (!facility_ids || !Array.isArray(facility_ids) || facility_ids.length === 0) {
            return NextResponse.json({ error: 'facility_ids array is required' }, { status: 400 })
        }
        if (!start_time || !end_time) {
            return NextResponse.json({ error: 'start_time and end_time are required' }, { status: 400 })
        }

        const newBlocks = facility_ids.map(facId => ({
            facility_id: facId,
            block_type: 'enrollment',
            start_time,
            end_time,
            reason: reason || 'Enrollment Period',
            created_by: user!.id
        }))

        const { data, error: dbError } = await supabase
            .from('facility_blocks')
            .insert(newBlocks)
            .select()

        if (dbError) throw dbError

        return NextResponse.json({ success: true, count: data.length, data })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
