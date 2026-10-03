import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkType() {
    console.log('--- Checking departments type ---')
    const { data, error } = await supabase.rpc('get_table_info', { t_name: 'departments' })

    // Try direct query if RPC fails
    const { data: qData, error: qError } = await supabase.from('departments').select('*').limit(1)
    console.log('Query result:', qData)
    if (qError) console.error('Query error:', qError)
}

checkType()
