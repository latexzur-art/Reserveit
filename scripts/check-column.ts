import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkColumn() {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Test selecting the column
    const { data, error } = await supabase
        .from('schedule_uploads')
        .select('batch_effective_date')
        .limit(1)

    if (error) {
        console.error('Error querying table:', error)
    } else {
        console.log('Success!', data)
    }
}

checkColumn()
