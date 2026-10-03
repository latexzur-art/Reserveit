import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
    console.log('--- Checking departments table ---')
    const { data: selectData, error: selectError } = await supabase.from('departments').select('*').limit(1)
    if (selectError) {
        console.error('Select failed:', selectError)
    } else {
        console.log('Columns found:', Object.keys(selectData?.[0] || {}).join(', '))
        console.log('Data sample:', JSON.stringify(selectData?.[0] || {}))
    }
}

checkSchema()
