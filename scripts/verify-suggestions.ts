import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verify() {
    console.log('--- Verifying Facility Suggestion Expansion ---')

    // 1. Fetch classrooms like the API does
    const { data: classrooms, error: cError } = await supabase
        .from('facilities')
        .select('id, name, room_number, is_active, status, facility_types!inner(name)')
        .eq('facility_types.name', 'classroom')
        .eq('is_active', true)
        .eq('status', 'available')
        .limit(10)

    if (cError) {
        console.error('Error fetching classrooms:', cError.message)
        return
    }

    console.log(`Found ${classrooms?.length ?? 0} available classrooms.`)
    classrooms?.forEach(f => console.log(` - ${f.name} (${f.room_number})`))

    // 2. Fetch a specialized facility to test the specializedAlts logic
    const { data: specialized, error: sError } = await supabase
        .from('facility_purpose_tags')
        .select('facility_id, tag')
        .limit(1)
        .single()

    if (sError || !specialized) {
        console.log('No specialized facilities found with tags. Check if seed was run.')
        return
    }

    const specializedTag = specialized.tag
    const facilityId = specialized.facility_id

    console.log(`Testing with specialized facility ID: ${facilityId}, Tag: ${specializedTag}`)

    const { data: sameFacilities } = await supabase
        .from('facility_purpose_tags')
        .select('facility:facilities!inner(id, name, room_number, is_active, status)')
        .eq('tag', specializedTag)
        .neq('facility_id', facilityId)

    const specializedAlts = (sameFacilities ?? []).map((f: any) => {
        const fac = Array.isArray(f.facility) ? f.facility[0] : f.facility
        return fac
    }).filter((f: any) => f?.is_active && f?.status === 'available')
        .map((f: any) => ({ id: f.id, name: f.name, room_number: f.room_number, available: true }))

    console.log(`Found ${specializedAlts.length} specialized alternatives.`)

    const classroomAlts = (classrooms ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        room_number: f.room_number,
        available: true,
    }))

    const combined = [...specializedAlts, ...classroomAlts]
    const seen = new Set()
    const alternativeFacilities = combined.filter(f => {
        if (f.id === facilityId || seen.has(f.id)) return false
        seen.add(f.id)
        return true
    }).slice(0, 15)

    console.log(`\nFinal suggestions for Academic Head (count: ${alternativeFacilities.length}):`)
    alternativeFacilities.forEach(f => console.log(` - ${f.name} (${f.room_number})`))

    if (alternativeFacilities.length > specializedAlts.length || (alternativeFacilities.length > 0 && specializedAlts.length === 0)) {
        console.log('\n✅ SUCCESS: Suggestions expanded to include classrooms.')
    } else if (classrooms?.length === 0) {
        console.log('\n⚠️ WARNING: No available classrooms found in DB to suggest.')
    } else {
        console.log('\n❌ FAILURE: Suggestions not expanded.')
    }
}

verify().catch(console.error)
