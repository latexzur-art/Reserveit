import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    const sql = `
        CREATE POLICY "Admins can view all uploads"
        ON public.schedule_uploads
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid()
                AND r.name IN ('academic_head', 'building_admin')
            )
        );
    `
    // Supabase JS doesn't have a direct way to run arbitrary SQL on the client
    // without invoking an RPC. But since this is a one-time fix for this environment
    // to prove the issue, we can just print the instruction for the user to run it
    // or we can use the existing `rpc` if available.
    console.log('--- PLEASE RUN THIS SQL IN YOUR SUPABASE DASHBOARD ---')
    console.log(sql)
    console.log('------------------------------------------------------')
}

run()
