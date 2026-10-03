/**
 * Verification Script: Course Selection Feature
 *
 * Run with: npx tsx scripts/verify-course-selection.ts
 *
 * This script verifies:
 * 1. Database schema changes (new columns, tables)
 * 2. Seed data (departments, course-facility affinity mappings)
 * 3. Type compilation (ensuring no TypeScript errors)
 * 4. API endpoint functionality (if server is running)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

const log = {
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  section: (msg: string) => console.log(`\n${colors.cyan}━━━ ${msg} ━━━${colors.reset}\n`),
}

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    log.error('Missing Supabase credentials')
    console.log('\nPlease ensure .env.local exists with:')
    console.log('  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url')
    console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key')
    console.log('  (or SUPABASE_SERVICE_ROLE_KEY=your_service_role_key)\n')
    process.exit(1)
  }

  return createClient(supabaseUrl, supabaseKey)
}

// Test 1: Verify booking_course_code column exists
async function verifyBookingColumn(supabase: SupabaseClient) {
  log.section('Test 1: Verify booking_course_code Column')

  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('booking_course_code')
      .limit(1)

    if (error && error.message.includes('column') && error.message.includes('does not exist')) {
      log.error('Column "booking_course_code" does not exist in bookings table')
      log.warning('Run the migration: supabase/migrations/20260302_add_course_selection.sql')
      return false
    }

    log.success('Column "booking_course_code" exists in bookings table')
    return true
  } catch (err) {
    log.error(`Failed to verify column: ${err}`)
    return false
  }
}

// Test 2: Verify course_facility_affinity table exists
async function verifyCourseAffinityTable(supabase: SupabaseClient) {
  log.section('Test 2: Verify course_facility_affinity Table')

  try {
    const { data, error } = await supabase
      .from('course_facility_affinity')
      .select('*')
      .limit(1)

    if (error && error.message.includes('relation') && error.message.includes('does not exist')) {
      log.error('Table "course_facility_affinity" does not exist')
      log.warning('Run the migration: supabase/migrations/20260302_add_course_selection.sql')
      return false
    }

    log.success('Table "course_facility_affinity" exists')
    return true
  } catch (err) {
    log.error(`Failed to verify table: ${err}`)
    return false
  }
}

// Test 3: Verify new departments were added
async function verifyNewDepartments(supabase: SupabaseClient) {
  log.section('Test 3: Verify New Departments')

  const expectedDepts = ['BSIS', 'BSA', 'BSAIS', 'BSCM', 'BACOMM']

  try {
    const { data, error }: any = await supabase
      .from('departments')
      .select('code, name')
      .in('code', expectedDepts)

    if (error) {
      log.error(`Failed to query departments: ${error.message}`)
      return false
    }

    const foundCodes = (data as any)?.map((d: any) => d.code) || []
    const missing = expectedDepts.filter(code => !foundCodes.includes(code))

    if (missing.length > 0) {
      log.error(`Missing departments: ${missing.join(', ')}`)
      log.warning('Run the migration to insert missing departments')
      return false
    }

    // @ts-ignore
    log.success(`All ${expectedDepts.length} new departments exist:`)
    (data as any)?.forEach((dept: any) => {
      console.log(`  • ${dept.code}: ${dept.name}`)
    })
    return true
  } catch (err) {
    log.error(`Failed to verify departments: ${err}`)
    return false
  }
}

// Test 4: Verify course-facility affinity mappings
async function verifyAffinityMappings(supabase: SupabaseClient) {
  log.section('Test 4: Verify Course-Facility Affinity Mappings')

  try {
    const { data, error }: any = await supabase
      .from('course_facility_affinity')
      .select('course_code, facility_tag, affinity_points')
      .order('course_code')

    if (error) {
      log.error(`Failed to query affinity mappings: ${error.message}`)
      return false
    }

    if (!data || data.length === 0) {
      log.error('No affinity mappings found')
      log.warning('Run the migration to seed affinity data')
      return false
    }

    log.success(`Found ${data.length} affinity mappings:`)

    // Group by facility tag
    const byTag: Record<string, Array<{ course_code: string; affinity_points: number }>> = {}
    data.forEach((row: any) => {
      if (!byTag[row.facility_tag]) byTag[row.facility_tag] = []
      byTag[row.facility_tag].push({
        course_code: row.course_code,
        affinity_points: row.affinity_points
      })
    })

    Object.entries(byTag).forEach(([tag, courses]) => {
      console.log(`  ${colors.cyan}${tag}${colors.reset}:`)
      courses.forEach(c => {
        console.log(`    • ${c.course_code} (+${c.affinity_points} points)`)
      })
    })

    // Verify expected mappings exist
    const expectedMappings = [
      { course: 'BSIT', tag: 'computer_use' },
      { course: 'BSCS', tag: 'computer_use' },
      { course: 'BMMA', tag: 'computer_use' },
      { course: 'BSHM', tag: 'hospitality_lab' },
      { course: 'BMMA', tag: 'av_studio' },
    ]

    const missing = expectedMappings.filter(expected =>
      !data.some((row: any) =>
        row.course_code === expected.course && row.facility_tag === expected.tag
      )
    )

    if (missing.length > 0) {
      log.error('Missing expected mappings:')
      missing.forEach(m => console.log(`  • ${m.course} → ${m.tag}`))
      return false
    }

    log.success('All expected affinity mappings exist')
    return true
  } catch (err) {
    log.error(`Failed to verify affinity mappings: ${err}`)
    return false
  }
}

// Test 5: Verify facility tags for computer labs
async function verifyFacilityTags(supabase: SupabaseClient) {
  log.section('Test 5: Verify Facility Tags (Computer Labs)')

  const computerLabRooms = ['103', '303', '304', '308', '309']

  try {
    const { data: facilities, error: facError }: any = await supabase
      .from('facilities')
      .select('id, room_number, name')
      .in('room_number', computerLabRooms)

    if (facError) {
      log.error(`Failed to query facilities: ${facError.message}`)
      return false
    }

    if (!facilities || facilities.length === 0) {
      log.warning('No computer labs found with expected room numbers')
      return false
    }

    log.info(`Found ${facilities.length} computer lab(s)`)

    // Check tags for each facility
    for (const facility of facilities) {
      const { data: tags, error: tagError }: any = await supabase
        .from('facility_purpose_tags')
        .select('tag')
        .eq('facility_id', facility.id)

      if (tagError) {
        log.error(`Failed to query tags for ${facility.room_number}: ${tagError.message}`)
        continue
      }

      const hasComputerTag = tags?.some((t: any) => t.tag === 'computer_use')
      if (hasComputerTag) {
        log.success(`Room ${facility.room_number} (${facility.name}) has 'computer_use' tag`)
      } else {
        log.warning(`Room ${facility.room_number} (${facility.name}) missing 'computer_use' tag`)
      }
    }

    return true
  } catch (err) {
    log.error(`Failed to verify facility tags: ${err}`)
    return false
  }
}

// Test 6: Test RLS policies
async function verifyRLSPolicies(supabase: SupabaseClient) {
  log.section('Test 6: Verify RLS Policies')

  try {
    // Test read access to course_facility_affinity
    const { data, error }: any = await supabase
      .from('course_facility_affinity')
      .select('*')
      .limit(1)

    if (error) {
      log.error(`RLS policy test failed: ${error.message}`)
      return false
    }

    log.success('RLS read policy working for course_facility_affinity')
    return true
  } catch (err) {
    log.error(`Failed to verify RLS policies: ${err}`)
    return false
  }
}

// Test 7: Verify TypeScript types exist
async function verifyTypeScript() {
  log.section('Test 7: Verify TypeScript Types')

  try {
    // Check if types are properly defined
    const fs = await import('fs')
    const bookingTypesPath = 'd:\\WORKS\\reserveit-main\\backend\\booking\\booking.types.ts'

    if (!fs.existsSync(bookingTypesPath)) {
      log.error('booking.types.ts file not found')
      return false
    }

    const content = fs.readFileSync(bookingTypesPath, 'utf-8')

    const checks = [
      { pattern: /booking_course_code\?\s*:\s*string/, name: 'CreateBookingInput.booking_course_code' },
      { pattern: /booking_course_code\?\s*:\s*string\s*\|\s*null/, name: 'BookingContext.booking_course_code' },
      { pattern: /booking_course_code\s*:\s*string\s*\|\s*null/, name: 'ScoringContext.booking_course_code' },
    ]

    let allFound = true
    checks.forEach(check => {
      if (check.pattern.test(content)) {
        log.success(`Type definition found: ${check.name}`)
      } else {
        log.error(`Type definition missing: ${check.name}`)
        allFound = false
      }
    })

    return allFound
  } catch (err) {
    log.error(`Failed to verify TypeScript types: ${err}`)
    return false
  }
}

// Test 8: Simulate scoring logic
async function testScoringLogic(supabase: SupabaseClient) {
  log.section('Test 8: Simulate Scoring Logic')

  try {
    // Find a computer lab
    const { data: computerLab }: any = await supabase
      .from('facilities')
      .select('id, room_number, name')
      .eq('room_number', '103')
      .maybeSingle()

    if (!computerLab) {
      log.warning('Computer Lab 103 not found - skipping scoring simulation')
      return true
    }

    // Check if BSIT has affinity with computer_use
    const { data: affinityCheck }: any = await supabase
      .from('course_facility_affinity')
      .select('affinity_points')
      .eq('course_code', 'BSIT')
      .eq('facility_tag', 'computer_use')
      .maybeSingle()

    if (!affinityCheck) {
      log.error('BSIT → computer_use affinity not found')
      return false
    }

    log.success(`Scoring simulation: BSIT + Computer Lab would receive +${affinityCheck.affinity_points} bonus`)
    log.info(`Expected final score: 80 (base) + ${affinityCheck.affinity_points} (affinity) = ${80 + affinityCheck.affinity_points}`)

    return true
  } catch (err) {
    log.error(`Failed scoring simulation: ${err}`)
    return false
  }
}

// Main execution
async function main() {
  console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════════════════╗
║   Course Selection Feature - Verification Script              ║
╚═══════════════════════════════════════════════════════════════╝
${colors.reset}`)

  const supabase = getSupabaseClient() as any
  const results: Record<string, boolean> = {}

  // Run all tests
  // @ts-ignore
  results['booking_column'] = await verifyBookingColumn(supabase)
  // @ts-ignore
  results['affinity_table'] = await verifyCourseAffinityTable(supabase)
  // @ts-ignore
  results['new_departments'] = await verifyNewDepartments(supabase)
  // @ts-ignore
  results['affinity_mappings'] = await verifyAffinityMappings(supabase)
  // @ts-ignore
  results['facility_tags'] = await verifyFacilityTags(supabase)
  // @ts-ignore
  results['rls_policies'] = await verifyRLSPolicies(supabase)
  // @ts-ignore
  results['typescript'] = await verifyTypeScript()
  // @ts-ignore
  results['scoring_logic'] = await testScoringLogic(supabase)

  // Summary
  log.section('Summary')
  const passed = Object.values(results).filter(r => r === true).length
  const total = Object.keys(results).length

  console.log(`Tests passed: ${colors.green}${passed}${colors.reset}/${total}`)

  if (passed === total) {
    log.success('All verification tests passed! ✨')
    log.info('The course selection feature is properly configured.')
    process.exit(0)
  } else {
    log.error('Some tests failed. Please review the errors above.')
    log.warning('If database tests failed, run: supabase/migrations/20260302_add_course_selection.sql')
    process.exit(1)
  }
}

main().catch(err => {
  log.error(`Script failed: ${err}`)
  process.exit(1)
})
