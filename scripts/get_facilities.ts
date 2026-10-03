import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables! Make sure .env.local is present.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function getFacilities() {
    console.log('Fetching facilities from database...\n')

    const { data, error } = await supabase
        .from('facilities')
        .select('id, name, room_number')
        .order('name')

    if (error) {
        console.error('Error fetching facilities:', error.message)
        return
    }

    if (!data || data.length === 0) {
        console.log('No facilities found in the database.')
        return
    }

    console.log('--- Database Rooms / Facilities ---')
    data.forEach((room, index) => {
        console.log(`${index + 1}. Name: "${room.name}" | Room Number: "${room.room_number || 'N/A'}"`)
    })
    console.log('-----------------------------------\n')
    console.log(`Total Facilities: ${data.length}`)
    console.log('\nMake sure your CSV room column exactly matches either the Name or Room Number shown above!')
}

getFacilities()
