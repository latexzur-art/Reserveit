import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function debugUsers() {
  console.log('🔗 Debugging Database Users...\n')
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, auth_user_id, account_status')

  if (error) {
    console.error('❌ Error fetching users:', error.message)
    return
  }

  console.log('📋 Registered Users in Database:')
  if (users && users.length > 0) {
    users.forEach(u => {
      console.log(`- Email: ${u.email} | Linked Auth ID: ${u.auth_user_id} | Status: ${u.account_status}`)
    })
  } else {
    console.log('⚠️ No users found in the "users" table!')
  }

  console.log('\n====================================')
}

debugUsers()
