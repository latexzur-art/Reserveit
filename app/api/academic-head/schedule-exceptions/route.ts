import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
export async function GET(request: NextRequest) {
    const { error: authError } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const datesParam = searchParams.get('dates')
    if (!datesParam) return NextResponse.json({ exceptions: [] })

    const dates = datesParam.split(',').filter(Boolean).slice(0, 14) // max 2 weeks
    if (dates.length === 0) return NextResponse.json({ exceptions: [] })

    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('class_schedule_exceptions')
        .select('id, schedule_id, exception_date, reason')
        .in('exception_date', dates)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ exceptions: data ?? [] })
}
