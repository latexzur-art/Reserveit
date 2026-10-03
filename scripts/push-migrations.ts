/**
 * Push Migrations Script
 *
 * Applies all SQL migrations to your Supabase database using the service role key.
 * Usage: npx tsx scripts/push-migrations.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'path'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!')
  console.error('Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Create admin client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function getMigrationFiles(): Promise<string[]> {
  const migrationsDir = resolve(process.cwd(), 'supabase', 'migrations')
  const files = await readdir(migrationsDir)
  return files
    .filter(f => f.endsWith('.sql'))
    .sort() // Sort by timestamp prefix
}

async function runMigration(filename: string): Promise<{ success: boolean; error?: string }> {
  const migrationsDir = resolve(process.cwd(), 'supabase', 'migrations')
  const filePath = join(migrationsDir, filename)

  try {
    const sql = await readFile(filePath, 'utf-8')

    // Execute the SQL using Supabase's rpc or raw query
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // If exec_sql doesn't exist, try direct approach
      // We'll need to use the REST API or pg directly
      throw new Error(error.message)
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

async function pushMigrations() {
  console.log('🚀 Starting migration push...\n')
  console.log('📍 Project URL:', supabaseUrl)
  console.log('')

  const files = await getMigrationFiles()

  if (files.length === 0) {
    console.log('ℹ️  No migration files found in supabase/migrations/')
    return
  }

  console.log(`📁 Found ${files.length} migration files:\n`)
  files.forEach((f, i) => console.log(`   ${i + 1}. ${f}`))
  console.log('')

  console.log('⚠️  Note: This script reads migration files but cannot execute raw SQL directly.')
  console.log('   Please use one of these methods to apply migrations:\n')

  console.log('📋 Option 1: Supabase Dashboard (Recommended for now)')
  console.log('   1. Go to https://supabase.com/dashboard/project/aascxdiyetopvrxifape/sql')
  console.log('   2. Open each migration file in VS Code')
  console.log('   3. Copy the SQL and paste into the SQL Editor')
  console.log('   4. Click "Run" to execute\n')

  console.log('📋 Option 2: Supabase CLI (Requires login)')
  console.log('   1. Run: npx supabase login')
  console.log('   2. Follow browser authentication')
  console.log('   3. Run: npm run db:migration:push\n')

  console.log('📋 Option 3: Direct Database Connection')
  console.log('   1. Get your database password from Supabase Dashboard > Settings > Database')
  console.log('   2. Use psql or a database tool to connect directly')
  console.log('   3. Run the migration SQL files\n')

  console.log('Migration files to apply (in order):')
  for (const file of files) {
    console.log(`   ✓ ${file}`)
  }
}

pushMigrations()
  .then(() => {
    console.log('\n✅ Script completed. Please apply migrations using one of the methods above.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
