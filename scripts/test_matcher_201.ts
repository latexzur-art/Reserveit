import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { matchFacility } from '../backend/schedule/facilityMatcher'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function testMatcher() {
    const inputs = ['Room 201', 'Room 301', 'Room 303', 'MPH1', 'Library', 'Gymnasium']

    console.log('Testing Matcher...')
    for (const input of inputs) {
        const result = await matchFacility(supabase, input)
        console.log(`Input: "${input}" -> Match ID: ${result.facility_id}, Confidence: ${result.confidence}`)

        if (result.facility_id) {
            const { data } = await supabase.from('facilities').select('name, room_number').eq('id', result.facility_id).single()
            if (data) {
                console.log(`   Matched to: [${data.room_number}] ${data.name}`)
            }
        }
    }
}

testMatcher()
