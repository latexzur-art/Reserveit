/**
 * CSV Parser for class schedule uploads.
 * Parses uploaded CSV text into RawCsvRow[] with flexible header mapping.
 * @module backend/schedule/csvParser
 */

import type { RawCsvRow } from './schedule.types'
import { findHeaderRowIndex, getFieldValue, mapColumns, parseCompositeDays } from './parserUtils'

const COMPOSITE_DAY_MAP: Record<string, string[]> = {
  mth: ['M', 'TH'],
  tf: ['T', 'F'],
  wf: ['W', 'F'],
  mwf: ['M', 'W', 'F'],
  tth: ['T', 'TH'],
  mw: ['M', 'W'],
}

export function parseCsvText(csvText: string): { rows: RawCsvRow[]; errors: string[] } {
  const allLines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  const errors: string[] = []

  if (allLines.length < 2) {
    return { rows: [], errors: ['CSV file must have a header row and at least one data row'] }
  }

  const allRows = allLines.map(line => parseCsvLine(line))
  const headerRowIndex = findHeaderRowIndex(allRows)
  const headers = allRows[headerRowIndex]
  const fieldMap = mapColumns(headers)

  const rawExtracted: RawCsvRow[] = []

  // Step 1: Extract rows from CSV text
  for (let i = headerRowIndex + 1; i < allRows.length; i++) {
    const arr = allRows[i]
    if (arr.length === 0 || (arr.length === 1 && !arr[0])) continue

    rawExtracted.push({
      row_number: i + 1,
      course_code: getFieldValue(arr, fieldMap, 'course_code') || undefined,
      course_name: getFieldValue(arr, fieldMap, 'course_name') || undefined,
      section: getFieldValue(arr, fieldMap, 'section') || undefined,
      facility_name: getFieldValue(arr, fieldMap, 'room') || undefined,
      instructor_name: getFieldValue(arr, fieldMap, 'instructor') || undefined,
      units_raw: getFieldValue(arr, fieldMap, 'units') || undefined,
      session_type_raw: getFieldValue(arr, fieldMap, 'session_type') || undefined,
      day_of_week_raw: getFieldValue(arr, fieldMap, 'day') || undefined,
      start_time_raw: getFieldValue(arr, fieldMap, 'start_time') || undefined,
      end_time_raw: getFieldValue(arr, fieldMap, 'end_time') || undefined,
      effective_start_date_raw: getFieldValue(arr, fieldMap, 'effective_start_date') || undefined,
      effective_end_date_raw: getFieldValue(arr, fieldMap, 'effective_end_date') || undefined,
    })
  }

  // Step 2: Apply Forward-Filling for blank continuation rows & Expand Composite Days
  const rows: RawCsvRow[] = []
  let lastCourseCode = ''
  let lastCourseName = ''
  let lastSection = ''
  let lastInstructorName = ''
  let lastFacilityName = ''
  let lastUnits = ''

  for (const rawRow of rawExtracted) {
    const hasTimeOrDay = !!(rawRow.start_time_raw || rawRow.day_of_week_raw)

    // Update or inherit course_code
    if (rawRow.course_code) {
      lastCourseCode = rawRow.course_code
    } else if (hasTimeOrDay && lastCourseCode) {
      rawRow.course_code = lastCourseCode
    }

    // Update or inherit section
    if (rawRow.section) {
      lastSection = rawRow.section
    } else if (hasTimeOrDay && lastSection) {
      rawRow.section = lastSection
    }

    // Update or inherit course_name
    if (rawRow.course_name) {
      lastCourseName = rawRow.course_name
    } else if (hasTimeOrDay && lastCourseName) {
      rawRow.course_name = lastCourseName
    }

    // Update or inherit instructor_name
    if (rawRow.instructor_name) {
      lastInstructorName = rawRow.instructor_name
    } else if (hasTimeOrDay && lastInstructorName) {
      rawRow.instructor_name = lastInstructorName
    }

    // Update or inherit units_raw
    if (rawRow.units_raw) {
      lastUnits = rawRow.units_raw
    } else if (hasTimeOrDay && lastUnits) {
      rawRow.units_raw = lastUnits
    }

    // Update or inherit facility_name if missing on continuation line
    if (rawRow.facility_name) {
      lastFacilityName = rawRow.facility_name
    } else if (hasTimeOrDay && lastFacilityName) {
      rawRow.facility_name = lastFacilityName
    }

    // Expand composite days (e.g. MF -> M, F | MT -> M, T | MWF -> M, W, F | TTH -> T, TH)
    const compositeDays = parseCompositeDays(rawRow.day_of_week_raw || '')

    if (compositeDays.length > 1) {
      for (const singleDay of compositeDays) {
        rows.push({
          ...rawRow,
          day_of_week_raw: singleDay,
        })
      }
    } else {
      rows.push(rawRow)
    }
  }

  return { rows, errors }
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cols.push(current)
  return cols
}

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0, '0': 0,
  monday: 1, mon: 1, m: 1, '1': 1,
  tuesday: 2, tue: 2, tues: 2, t: 2, '2': 2,
  wednesday: 3, wed: 3, w: 3, '3': 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, th: 4, '4': 4,
  friday: 5, fri: 5, f: 5, '5': 5,
  saturday: 6, sat: 6, '6': 6,
}

export function parseDayOfWeek(raw: string): number | null {
  const normalized = raw.toLowerCase().trim()
  return DAY_MAP[normalized] ?? null
}

export function parseTime(raw: string): string | null {
  if (!raw) return null

  // "8:00 AM" / "08:00 AM" / "8:00AM"
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1])
    const m = parseInt(ampmMatch[2])
    const period = ampmMatch[3].toLowerCase()
    if (period === 'pm' && h !== 12) h += 12
    if (period === 'am' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
  }

  // "08:00" / "8:00"
  const timeMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (timeMatch) {
    const h = parseInt(timeMatch[1])
    const m = parseInt(timeMatch[2])
    const s = parseInt(timeMatch[3] ?? '0')
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return null
}

export function parseDate(raw: string | undefined): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}
