import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
    // Get the most recent upload ID
    const { data: uploads } = await supabase.from('schedule_uploads').select('*').order('created_at', { ascending: false }).limit(1)
    if (!uploads?.length) return console.log('No uploads found')

    const upload = uploads[0]
    console.log('Latest Upload:', upload.id)

    // Check total approved entries
    const { data: approved } = await supabase
        .from('schedule_entries_staging')
        .select('*')
        .eq('schedule_upload_id', upload.id)
        .eq('academic_head_review_status', 'academic_head_approved')

    console.log('Total Approved Entries:', approved?.length)

    // Check how many have missing facilities
    const missingFac = approved?.filter(a => !a.facility_id) || []
    console.log('Approved but missing facility_id:', missingFac.length)
    if (missingFac.length > 0) {
        console.log('Sample missing facility:', missingFac[0].course_code, missingFac[0].facility_name_raw)
    }

    // Check published schedules
    const { data: published } = await supabase
        .from('class_schedules')
        .select('*')
        .eq('schedule_upload_id', upload.id)

    console.log('Successfully Published to class_schedules:', published?.length)

    // Find WHICH ones failed to publish if they had a facility
    const publishedStagingIds = new Set(published?.map(p => p.staging_entry_id))
    const failedToPublish = approved?.filter(a => a.facility_id && !publishedStagingIds.has(a.id)) || []

    console.log('\nFailed to insert into class_schedules despite having facility_id:', failedToPublish.length)
    if (failedToPublish.length > 0) {
        console.log('Sample failed entry:', failedToPublish[0].course_code, failedToPublish[0].section, failedToPublish[0].facility_name_raw)
        // Check if there's a reason they might fail (e.g. invalid dates, missing instructor)
        // We can try a test insert and catch the exact Postgres error
        const entry = failedToPublish[0]
        const { error: insertErr } = await supabase
            .from('class_schedules')
            .insert({
                schedule_upload_id: upload.id,
                staging_entry_id: entry.id,
                academic_term_id: upload.academic_term_id,
                department_id: upload.department_id,
                facility_id: entry.facility_id,
                course_code: entry.course_code,
                course_name: entry.course_name,
                section: entry.section,
                instructor_id: entry.instructor_id,
                instructor_name: entry.instructor_name,
                day_of_week: entry.day_of_week,
                start_time: entry.start_time,
                end_time: entry.end_time,
                effective_start_date: entry.effective_start_date || upload.batch_effective_date || '2026-01-01',
                effective_end_date: entry.effective_end_date || upload.batch_effective_end_date || '2026-06-01',
                is_active: true,
                version: 1,
            })

        console.log('Test Insert Error for failed entry:', insertErr)
    }
}
run()
