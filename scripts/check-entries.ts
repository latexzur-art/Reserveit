import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function main() {
    // First, use service role to get the upload ID and the user
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: uploads } = await admin
        .from('schedule_uploads')
        .select('id, uploaded_by')
        .order('created_at', { ascending: false })
        .limit(1)

    if (!uploads?.length) {
        console.log('No uploads found')
        return
    }

    const uploadId = uploads[0].id
    const userId = uploads[0].uploaded_by
    console.log('Upload ID:', uploadId)
    console.log('Uploaded by:', userId)

    // Count entries via service role
    const { count: serviceCount } = await admin
        .from('schedule_entries_staging')
        .select('*', { count: 'exact', head: true })
        .eq('schedule_upload_id', uploadId)
    console.log('Entries via service role:', serviceCount)

    // Now try with anon key (simulating client-side)
    // We need to sign in as the academic head to test RLS
    // But we can't easily do that here, so let's just check the anon key
    const anon = createClient(supabaseUrl, anonKey)

    const { data: anonData, error: anonErr } = await anon
        .from('schedule_entries_staging')
        .select('id')
        .eq('schedule_upload_id', uploadId)

    console.log('Entries via anon key:', anonData?.length ?? 0)
    if (anonErr) console.log('Anon error:', anonErr.message)

    // Check all RLS policies on schedule_entries_staging
    const { data: policies } = await admin.rpc('exec_sql', {
        sql: `SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'schedule_entries_staging'`
    }).single()

    // Alternative: query pg_policies directly  
    const { data: polData, error: polErr } = await admin
        .from('pg_policies')
        .select('*')

    if (polErr) {
        console.log('\nCannot query pg_policies directly, trying information_schema...')
    }

    // Let's check the upload's details more carefully
    const { data: uploadDetail } = await admin
        .from('schedule_uploads')
        .select('id, upload_mode, upload_status, department_id')
        .eq('id', uploadId)
        .single()
    console.log('\nUpload detail:', JSON.stringify(uploadDetail))
}

main().catch(console.error)
