import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function inspect() {
  const { data: batches } = await supabase
    .from('course_uploads')
    .select('id, upload_status, created_at, uploader_notes, total_entries, approved_count, pending_count')
    .order('created_at', { ascending: false })
    .limit(5)

  console.log("=== RECENT BATCHES ===")
  console.log(batches)

  if (batches && batches.length > 0) {
    for (const batch of batches) {
      const { data: courses } = await supabase
        .from('courses')
        .select('id, course_code, approval_status, batch_upload_id, department_code')
        .eq('batch_upload_id', batch.id)
      
      console.log(`\n=== Courses for Batch ${batch.id} (${batch.upload_status}) ===`)
      console.log(courses)
    }
  }
}

inspect()
