const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL
    });

    try {
        await client.connect();
        console.log('Connected to PG');
        await client.query('ALTER TABLE public.schedule_entries_staging ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;');
        console.log('Successfully added is_published column.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

run();
