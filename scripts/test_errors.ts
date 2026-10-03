import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
    const { data } = await supabase.from('schedule_entries_staging').select('validation_errors, validation_warnings').eq('validation_status', 'error').limit(2)
    console.log(JSON.stringify(data, null, 2))
}
run()
