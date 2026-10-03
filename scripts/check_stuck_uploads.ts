import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function fixGhostUpload() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) return;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking for ANY uploads...");
    const { data: uploads, error } = await supabase
        .from('schedule_uploads')
        .select('*');

    console.log("All uploads currently in DB:");
    console.log(uploads);

    if (uploads && uploads.length > 0) {
        console.log("Deleting all uploads to clear the constraint issue...");
        const { error: delErr } = await supabase.from('schedule_uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (delErr) {
            console.error(delErr);
        } else {
            console.log("Successfully cleared uploads!");
        }
    }
}

fixGhostUpload().catch(console.error);
