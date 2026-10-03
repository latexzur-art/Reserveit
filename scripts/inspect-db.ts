import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function inspect() {
  console.log("--- ALL COURSES THAT ARE NOT APPROVED ---")
  const { data: courses, error: err } = await supabase
    .from('courses')
    .select(`
      id,
      course_code,
      course_name,
      approval_status,
      batch_upload_id,
      created_by,
      course_uploads(upload_status, submitted_at)
    `)
    .not('approval_status', 'eq', 'approved')
    .not('approval_status', 'eq', 'rejected')
  
  if (err) {
    console.error("Failed to fetch courses:", err)
  } else {
    console.log(`Found ${courses?.length} non-approved courses:`)
    console.dir(courses, { depth: null })
  }
}

inspect()
