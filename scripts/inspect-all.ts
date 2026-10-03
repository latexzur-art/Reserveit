import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function inspect() {
  console.log("--- BATCHES ---")
  const { data: batches } = await supabase
    .from('course_uploads')
    .select(`
      id,
      upload_status,
      uploaded_by,
      total_entries,
      pending_count,
      approved_count,
      rejected_count,
      created_at,
      submitted_at,
      reviewed_at
    `)
    .in('id', ['80ac6961-1126-47f2-a76c-b88d8d443747', '08247419-57aa-4175-a63c-578e42ccf794'])
  console.log(JSON.stringify(batches, null, 2))

  console.log("\n--- USERS ---")
  const userIds = batches ? Array.from(new Set(batches.map(b => b.uploaded_by))) : []
  console.log("User IDs of uploaders:", userIds)

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, user_type, account_status')
    .in('id', [...userIds, '69590c3c-ee52-4c49-a2e0-6f8c3d2d543e'])
  console.log(JSON.stringify(users, null, 2))

  console.log("\n--- ROLES FOR USERS ---")
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select(`
      user_id,
      is_active,
      roles ( id, name, display_name )
    `)
    .in('user_id', users ? users.map(u => u.id) : [])
  console.log(JSON.stringify(userRoles, null, 2))

  console.log("\n--- AUDIT LOGS ---")
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: true })
  
  const filteredLogs = auditLogs ? auditLogs.filter((l: any) => 
    l.target_id === '80ac6961-1126-47f2-a76c-b88d8d443747' || 
    l.target_id === '08247419-57aa-4175-a63c-578e42ccf794' ||
    (l.details && JSON.stringify(l.details).includes('80ac6961-1126-47f2-a76c-b88d8d443747')) ||
    (l.details && JSON.stringify(l.details).includes('08247419-57aa-4175-a63c-578e42ccf794'))
  ) : []
  console.log(JSON.stringify(filteredLogs, null, 2))
}

inspect()
