/**
 * Supabase Connection Test Script
 *
 * Run this to verify your Supabase configuration is correct.
 * Usage: npx tsx scripts/test-connection.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables!')
  console.error('Make sure .env.local exists with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

async function testConnection() {
  console.log('🔗 Testing Supabase connection...\n')

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    // Test 1: Basic connection
    console.log('📍 Project URL:', supabaseUrl)
    console.log('🔑 Anon Key:', supabaseAnonKey.substring(0, 20) + '...')
    console.log('')

    // Test 2: Try to query (will fail if no tables, but connection works)
    const { error } = await supabase
      .from('_test_')
      .select('*')
      .limit(1)

    if (error) {
      // Error code 42P01 or table not found messages mean "table doesn't exist" - this is expected!
      if (
        error.code === '42P01' ||
        error.message.includes('does not exist') ||
        error.message.includes('Could not find the table')
      ) {
        console.log('✅ Connection successful!')
        console.log('✅ Authentication working!')
        console.log('ℹ️  Database is empty (expected at this stage)')
        console.log('')
        console.log('🎉 Your Supabase setup is complete!')
        console.log('📝 Next step: Run Phase 1.2 to create database tables')
        return true
      } else {
        console.error('❌ Unexpected error:', error.message)
        console.error('Error code:', error.code)
        return false
      }
    }

    console.log('✅ Connection successful!')
    console.log('✅ Database accessible!')
    return true

  } catch (err) {
    console.error('❌ Connection failed:', err)
    console.error('')
    console.error('Troubleshooting:')
    console.error('1. Check your .env.local file exists')
    console.error('2. Verify the keys are correct (no extra spaces)')
    console.error('3. Make sure your Supabase project is active')
    return false
  }
}

testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
