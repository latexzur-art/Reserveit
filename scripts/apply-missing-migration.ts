/**
 * Directly applies the missing schedule_management_expansion migration
 * to the remote Supabase database via the pg client.
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

// We'll use the Supabase Management API via the service role key instead
// Actually, let's use the supabase-js client with rpc to run raw SQL

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
    const supabase = createClient(supabaseUrl, serviceKey)

    // Try using the Supabase SQL editor API endpoint directly
    const sql = `
    ALTER TABLE public.schedule_uploads
      ADD COLUMN IF NOT EXISTS batch_effective_date DATE,
      ADD COLUMN IF NOT EXISTS batch_effective_end_date DATE;
  `

    // Use the REST API to execute SQL via the pg_net extension or rpc
    // Actually, PostgREST doesn't support raw SQL. Let's check if there's an rpc function we can use.

    // The simplest way: use the pg module directly with the database URL
    // We need the database password from Supabase dashboard

    // Alternative: use the Supabase Management API
    const projectRef = 'aascxdiyetopvrxifape'

    // Let's try a different approach - query to see what columns exist
    const { data, error } = await supabase
        .from('schedule_uploads')
        .select('*')
        .limit(0)

    if (error) {
        console.error('Error:', error.message)
    } else {
        console.log('Columns available:', Object.keys(data[0] || {}))
        console.log('Note: empty result means no rows, columns not visible')
    }

    // Let's try inserting with the column to see if it exists
    console.log('\nTrying to select batch_effective_date...')
    const { data: d2, error: e2 } = await supabase
        .from('schedule_uploads')
        .select('id, batch_effective_date')
        .limit(1)

    if (e2) {
        console.error('Column check error:', e2.message)
        console.log('\n⚠️  The batch_effective_date column does NOT exist on the remote database.')
        console.log('You need to run this SQL in the Supabase SQL Editor:')
        console.log('─'.repeat(60))
        console.log(sql)
        console.log('─'.repeat(60))
    } else {
        console.log('✅ Column exists! Data:', d2)
    }
}

main().catch(console.error)
