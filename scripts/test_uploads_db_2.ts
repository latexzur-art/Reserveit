import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data: uploads, error } = await supabase
        .from('schedule_uploads')
        .select('id, upload_status, created_at, uploaded_by, academic_terms(term_name)')
        .order('created_at', { ascending: false })

    console.log('--- ALL UPLOADS (SERVICE ROLE) ---')
    if (error) console.error(error.message)
    else console.log(JSON.stringify(uploads, null, 2))
}
check()
