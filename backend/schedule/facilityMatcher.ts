/**
 * Facility Matcher
 * Resolves raw facility names from CSV to facility_ids using fuzzy matching.
 * @module backend/schedule/facilityMatcher
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface MatchResult {
  facility_id: string | null
  confidence: number
}

let facilityCache: Array<{ id: string; name: string; room_number: string | null; code: string }> | null = null

async function loadFacilities(supabase: SupabaseClient) {
  if (facilityCache) return facilityCache
  const { data } = await supabase
    .from('facilities')
    .select('id, name, room_number, code')
    .eq('status', 'available')
  facilityCache = data ?? []
  return facilityCache
}

export function clearFacilityCache() {
  facilityCache = null
}

export async function matchFacility(
  supabase: SupabaseClient,
  rawName: string
): Promise<MatchResult> {
  const facilities = await loadFacilities(supabase)
  const normalized = rawName.toLowerCase().trim()

  if (!normalized) return { facility_id: null, confidence: 0 }

  // 1. Check Custom Aliases (Common abbreviations used in CSVs that don't match db exactly)
  const roomAliases: Record<string, string> = {
    'cl1': 'room 103 - computer laboratory',
    'cl2': 'room 303 - computer laboratory',
    'cl3': 'room 304 - computer laboratory',
    'cl4': 'room 308 - computer laboratory',
    'cl5': 'room 309 - computer laboratory',
    'auditorium': 'mph1', // Assuming MPH1 or MPH3 is the auditorium. We use MPH1.
    'gym': 'mph1',
    'gymnasium': 'mph1',
  }

  const aliasMatch = roomAliases[normalized]
  if (aliasMatch) {
    const matchedAliasFacility = facilities.find(f =>
      f.name.toLowerCase() === aliasMatch ||
      f.room_number?.toLowerCase() === aliasMatch
    )
    if (matchedAliasFacility) {
      return { facility_id: matchedAliasFacility.id, confidence: 1.0 }
    }
  }

  // 2. Exact match on code (e.g. 3F-CL-303)
  const exactCode = facilities.find((f) => f.code.toLowerCase() === normalized)
  if (exactCode) return { facility_id: exactCode.id, confidence: 1.0 }

  // 3. Exact match on name (case-insensitive)
  const exactName = facilities.find((f) => f.name.toLowerCase() === normalized)
  if (exactName) return { facility_id: exactName.id, confidence: 1.0 }

  // 3. Exact match on room_number
  const exactRoom = facilities.find((f) => f.room_number?.toLowerCase() === normalized)
  if (exactRoom) return { facility_id: exactRoom.id, confidence: 1.0 }

  // 3. Extract potential room number from raw text and test against room_number
  // Skip extraction for structured codes like "3F-CL-306" — they already failed exact code
  // match and the extracted number would ambiguously match unrelated rooms.
  const isStructuredCode = /^[a-z0-9]+-[a-z]+-[a-z0-9]+$/i.test(normalized)
  const possibleRoomNumberMatch = normalized.match(/\b\d{3}\b/)
  if (!isStructuredCode && possibleRoomNumberMatch) {
    const extractedNumber = possibleRoomNumberMatch[0]
    const extractedMatch = facilities.find((f) => f.room_number?.toLowerCase() === extractedNumber)
    if (extractedMatch) {
      return { facility_id: extractedMatch.id, confidence: 1.0 }
    }
  }

  // 4. Contains match (name contains raw or raw contains name)
  const containsMatches = facilities.filter(
    (f) =>
      f.name.toLowerCase().includes(normalized) ||
      normalized.includes(f.name.toLowerCase()) ||
      (f.room_number && (
        f.room_number.toLowerCase().includes(normalized) ||
        normalized.includes(f.room_number.toLowerCase())
      ))
  )

  if (containsMatches.length === 1) {
    return { facility_id: containsMatches[0].id, confidence: 0.8 }
  }

  if (containsMatches.length > 1) {
    // If multiple partial matches exist (e.g., "Room 301" matching multiple things)
    // Try to see if one of those matches shares an exact word boundary number
    if (possibleRoomNumberMatch) {
      const extractedNumber = possibleRoomNumberMatch[0]
      const betterMatch = containsMatches.find(f =>
        f.room_number?.toLowerCase() === extractedNumber ||
        f.name.toLowerCase().includes(` ${extractedNumber} `) ||
        f.name.toLowerCase().includes(`-${extractedNumber}`) ||
        f.name.toLowerCase().includes(` ${extractedNumber}-`)
      )
      if (betterMatch) {
        return { facility_id: betterMatch.id, confidence: 0.8 }
      }
    }

    // Pick the one with shortest name (most specific match)
    const best = containsMatches.sort((a, b) => a.name.length - b.name.length)[0]
    return { facility_id: best.id, confidence: 0.6 }
  }

  // 5. No match
  return { facility_id: null, confidence: 0 }
}

export interface InstructorMatchResult {
  instructor_id: string | null
  ambiguous: boolean
}

export async function matchInstructor(
  supabase: SupabaseClient,
  rawName: string
): Promise<InstructorMatchResult> {
  if (!rawName.trim()) return { instructor_id: null, ambiguous: false }

  const normalized = rawName.toLowerCase().trim()

  let { data } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('user_type', 'internal')
    .ilike('full_name', `%${normalized}%`)
    .limit(5)

  if (!data || data.length === 0) {
    const words = normalized.replace(/[.,]/g, ' ').split(/\s+/).filter(w => w.length > 1)
    if (words.length > 0) {
      let query = supabase
        .from('users')
        .select('id, full_name')
        .eq('user_type', 'internal')
      
      words.forEach(w => {
        query = query.ilike('full_name', `%${w}%`)
      })
      
      const res = await query.limit(5)
      data = res.data || []
    }
  }

  if (!data || data.length === 0) return { instructor_id: null, ambiguous: false }
  if (data.length === 1) return { instructor_id: data[0].id, ambiguous: false }

  // Prefer exact match
  const exact = data.find((u) => u.full_name.toLowerCase() === normalized)
  if (exact) return { instructor_id: exact.id, ambiguous: false }
  
  return { instructor_id: null, ambiguous: true }
}
