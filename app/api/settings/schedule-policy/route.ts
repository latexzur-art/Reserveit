import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAcademicHeadOrBuildingAdmin } from '@/lib/auth/guards'
import { DEFAULT_MIN_LEAD_DAYS, MIN_LEAD_DAYS_KEY } from '@/lib/reservation-lead-time'

const STRICT_KEY = 'strict_instructor_requirement'

export async function GET() {
    const supabase = createAdminClient()

    const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [STRICT_KEY, MIN_LEAD_DAYS_KEY])

    const byKey = new Map((data ?? []).map(r => [r.key, r.value]))
    const leadDays = byKey.get(MIN_LEAD_DAYS_KEY)

    return NextResponse.json({
        strict_instructor_requirement: byKey.get(STRICT_KEY) === true,
        min_reservation_lead_days: typeof leadDays === 'number' ? leadDays : DEFAULT_MIN_LEAD_DAYS,
    })
}

export async function PATCH(request: NextRequest) {
    const { error: authError, user } = await requireAcademicHeadOrBuildingAdmin()
    if (authError) return authError

    const body = await request.json()
    const supabase = createAdminClient()

    // Field-aware: only touch the settings named in the body so one control
    // can't clobber the other's value.
    if (STRICT_KEY in body) {
        const { error } = await supabase
            .from('system_settings')
            .upsert({
                key: STRICT_KEY,
                value: body.strict_instructor_requirement === true,
                category: 'schedule',
                description: 'Require all uploaded schedule entries to have an assigned instructor',
                updated_by: user.id,
            }, { onConflict: 'key' })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (MIN_LEAD_DAYS_KEY in body) {
        const n = Number(body.min_reservation_lead_days)
        if (!Number.isInteger(n) || n < 0 || n > 14) {
            return NextResponse.json(
                { error: 'min_reservation_lead_days must be a whole number between 0 and 14' },
                { status: 400 }
            )
        }
        const { error } = await supabase
            .from('system_settings')
            .upsert({
                key: MIN_LEAD_DAYS_KEY,
                value: n,
                category: 'schedule',
                description: 'Minimum days of advance notice required to reserve a non-paid facility (Sundays excluded)',
                updated_by: user.id,
            }, { onConflict: 'key' })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
