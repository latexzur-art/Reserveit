import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
    const { data } = await supabase.from('schedule_entries_staging').select('validation_status, validation_errors')
    const counts = data?.reduce((acc, row) => {
        acc[row.validation_status] = (acc[row.validation_status] || 0) + 1
        return acc
    }, {} as Record<string, number>)
    console.log(counts)

    const errs = data?.filter(d => d.validation_status === 'error') || []
    if (errs.length > 0) {
        console.log('Errors sample:', JSON.stringify(errs.slice(0, 1), null, 2))
    }
}
run()
