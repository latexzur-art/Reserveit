import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
    // 1. Get an upload ID
    const { data: uploads } = await supabase.from('schedule_uploads').select('id').limit(1)
    if (!uploads?.length) {
        console.log('No uploads found')
        return
    }
    const id = uploads[0].id
    console.log('Deleting upload:', id)

    // 2. Try deleting via API simulation
    const res = await fetch(`http://localhost:3000/api/schedules/uploads/${id}`, {
        method: 'DELETE',
        headers: {
            'cookie': 'sb-refresh-token=dummy', // Will fail auth but check routing
        }
    })
    console.log('Status:', res.status)
    try {
        const text = await res.text()
        console.log('Body:', text)
    } catch (e) { }
}
run()
