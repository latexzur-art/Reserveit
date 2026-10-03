/**
 * parserUtils.ts
 * Utility functions for robust Excel/CSV parsing of schedules.
 * Handles header detection, alias mapping, and Excel date/time formatting.
 */

export const COLUMN_ALIASES: Record<string, string[]> = {
    course_code: ['course code', 'course_code', 'subject code', 'code', 'subject'],
    course_name: ['course title', 'course name', 'course_name', 'subject name', 'description'],
    section: ['section', 'course', 'sec', 'class', 'block', 'class section', 'section code'],
    room: ['room', 'room no', 'room no.', 'room number', 'facility', 'venue', 'lab', 'location', 'classroom'],
    instructor: ['instructors', 'instructor', 'teacher', 'faculty', 'professor', 'prof', 'instructor name'],
    units: ['units', 'unit', 'credits', 'credit_units', 'no. of units'],
    session_type: ['type', 'session type', 'session_type', 'mode', 'delivery mode', 'delivery_mode'],
    day: ['day', 'days', 'day(s)', 'schedule day', 'day of week'],
    start_time: ['start time', 'start_time', 'time start', 'from', 'start', 'starttime'],
    end_time: ['end time', 'end_time', 'time end', 'to', 'end', 'endtime'],
    effective_start_date: ['start date', 'effective start', 'start_date'],
    effective_end_date: ['end date', 'effective end', 'end_date'],
}

/**
 * Normalizes a header string for alias matching.
 */
export function normalizeHeader(h: string): string {
    return String(h || '').toLowerCase().trim().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ')
}

/**
 * Formats a raw value from an Excel cell or CSV column.
 * Handles Date objects (extracting time or date) and strings.
 */
export function formatValue(value: any, fieldHint?: string): string {
    if (value === null || value === undefined) return ''
    
    // Handle ExcelJS objects (e.g., formula results)
    let val = value
    if (typeof value === 'object' && 'result' in value) {
        val = value.result
    }
    if (typeof value === 'object' && 'richText' in value) {
        val = value.richText.map((rt: any) => rt.text).join('')
    }

    if (val instanceof Date) {
        // If it's a time column, extract HH:mm
        if (fieldHint?.includes('time')) {
            const h = val.getUTCHours().toString().padStart(2, '0')
            const m = val.getUTCMinutes().toString().padStart(2, '0')
            return `${h}:${m}`
        }
        
        // If it's a date column, extract YYYY-MM-DD
        if (fieldHint?.includes('date')) {
            return val.toISOString().split('T')[0]
        }
        
        // Fallback for dates in non-date columns (shouldn't happen often)
        return val.toISOString()
    }
    
    // Check if it's a string that LOOKS like an Excel 1899 date
    if (typeof val === 'string' && val.includes('1899') && fieldHint?.includes('time')) {
        const timeMatch = val.match(/(\d{1,2}):(\d{2})/ )
        if (timeMatch) return timeMatch[0]
    }

    return String(val ?? '').trim()
}

/**
 * Maps a list of headers to their canonical field names using aliases.
 */
export function mapColumns(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {}
    const normalizedHeaders = headers.map(normalizeHeader)

    let matchCount = 0
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        for (let i = 0; i < normalizedHeaders.length; i++) {
            if (aliases.includes(normalizedHeaders[i])) {
                map[field] = i
                matchCount++
                break
            }
        }
    }

    // Fallback if match count is low (less than 3 mandatory fields matched)
    if (matchCount < 3) {
        return {
            course_code: 0,
            course_name: 1,
            section: 2,
            room: 3,
            instructor: 4,
            session_type: 5,
            day: 6,
            start_time: 7,
            end_time: 8
        }
    }

    return map
}

/**
 * Safely retrieves a field value from a row array using the column map.
 */
export function getFieldValue(row: any[], columnMap: Record<string, number>, field: string): string {
    const idx = columnMap[field]
    if (idx === undefined || idx < 0 || idx >= row.length) return ''
    return formatValue(row[idx], field)
}

/**
 * Scans rows for a potential header row containing keywords.
 */
export function findHeaderRowIndex(rows: any[][]): number {
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i]
        let matches = 0
        for (const cell of row) {
            const norm = normalizeHeader(String(cell || ''))
            if (
                norm === 'course code' ||
                norm === 'subject' ||
                norm === 'room' ||
                norm === 'section' ||
                norm === 'course' ||
                norm === 'course title' ||
                norm === 'instructors' ||
                norm === 'instructor' ||
                norm === 'start' ||
                norm === 'end'
            ) {
                matches++
            }
        }
        if (matches >= 2) return i
    }
    return 0 // Default to first row
}

const COMPOSITE_DAY_DICTIONARY: Record<string, string[]> = {
  mth: ['M', 'TH'],
  tth: ['T', 'TH'],
  tthu: ['T', 'TH'],
  mwf: ['M', 'W', 'F'],
  tf: ['T', 'F'],
  wf: ['W', 'F'],
  mw: ['M', 'W'],
  mf: ['M', 'F'],
  mt: ['M', 'T'],
  ms: ['M', 'SAT'],
  ts: ['T', 'SAT'],
  ws: ['W', 'SAT'],
  ths: ['TH', 'SAT'],
  fs: ['F', 'SAT'],
}

/**
 * Dynamically parses composite day codes like 'MF', 'MT', 'MWF', 'TTH', 'MTH', 'TF', 'WF', 'MW'
 * into an array of individual day strings ('M', 'T', 'W', 'TH', 'F', 'SAT', 'SUN').
 */
export function parseCompositeDays(raw: string): string[] {
  if (!raw) return []
  const norm = raw.toLowerCase().trim().replace(/[\s\-,/]/g, '')
  if (!norm) return []

  if (COMPOSITE_DAY_DICTIONARY[norm]) {
    return COMPOSITE_DAY_DICTIONARY[norm]
  }

  // Handle single full/abbreviated day names
  if (norm === 'm' || norm === 'mon' || norm === 'monday') return ['M']
  if (norm === 't' || norm === 'tue' || norm === 'tues' || norm === 'tuesday') return ['T']
  if (norm === 'w' || norm === 'wed' || norm === 'wednesday') return ['W']
  if (norm === 'th' || norm === 'thu' || norm === 'thur' || norm === 'thurs' || norm === 'thursday') return ['TH']
  if (norm === 'f' || norm === 'fri' || norm === 'friday') return ['F']
  if (norm === 'sat' || norm === 'saturday') return ['SAT']
  if (norm === 'sun' || norm === 'sunday') return ['SUN']

  // Dynamic multi-day character scanner
  const result: string[] = []
  const s = norm.replace(/thu|thur|thurs|th/g, 'H').replace(/sat|saturday/g, 'S').replace(/sun|sunday/g, 'U')

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === 'm') result.push('M')
    else if (ch === 't') result.push('T')
    else if (ch === 'w') result.push('W')
    else if (ch === 'H') result.push('TH')
    else if (ch === 'f') result.push('F')
    else if (ch === 'S') result.push('SAT')
    else if (ch === 'U') result.push('SUN')
  }

  return result.length > 0 ? result : [raw.trim()]
}
