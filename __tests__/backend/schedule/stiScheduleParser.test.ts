import { describe, it, expect } from 'vitest'
import { mapColumns, findHeaderRowIndex } from '@/backend/schedule/parserUtils'
import { parseCsvText } from '@/backend/schedule/csvParser'
import { validateAndEnrichEntry } from '@/backend/schedule/entryValidator'

describe('STI Official Schedule Template Parser (TDD Suite)', () => {
  it('correctly maps STI headers (COURSE vs COURSE CODE, INSTRUCTORS)', () => {
    const headers = [
      'COURSE',
      'DAY',
      'START',
      'END',
      'ROOM',
      'MERGE',
      'COURSE CODE',
      'COURSE TITLE',
      'UNITS',
      'INSTRUCTORS',
      'CLASS NO.',
      'CODE',
      'SECTION CODE',
    ]

    const columnMap = mapColumns(headers)
    expect(columnMap.section).toBe(0)      // 'COURSE' -> section
    expect(columnMap.day).toBe(1)          // 'DAY' -> day
    expect(columnMap.start_time).toBe(2)   // 'START' -> start_time
    expect(columnMap.end_time).toBe(3)     // 'END' -> end_time
    expect(columnMap.room).toBe(4)         // 'ROOM' -> room/facility
    expect(columnMap.course_code).toBe(6)  // 'COURSE CODE' -> course_code
    expect(columnMap.course_name).toBe(7)  // 'COURSE TITLE' -> course_name
    expect(columnMap.instructor).toBe(9)   // 'INSTRUCTORS' -> instructor
    expect(columnMap.units).toBe(8)        // 'UNITS' -> units
  })

  it('correctly detects header row index', () => {
    const rows = [
      ['STI College Schedule', '', '', ''],
      ['COURSE', 'DAY', 'START', 'END', 'ROOM', 'MERGE', 'COURSE CODE', 'COURSE TITLE', 'UNITS', 'INSTRUCTORS'],
      ['BSCS 4/1-1', 'F', '12:00 PM', '1:00 PM', '201', '', 'STIC1007', 'Euthenics 2', '1', 'Gonzales'],
    ]

    const idx = findHeaderRowIndex(rows)
    expect(idx).toBe(1)
  })

  it('expands composite days and applies forward-filling to continuation rows', () => {
    const csvContent = [
      'COURSE,DAY,START,END,ROOM,MERGE,COURSE CODE,COURSE TITLE,UNITS,INSTRUCTORS,CLASS NO.',
      'BSCS 4/1-1,F,12:00 PM,1:00 PM,201,,STIC1007,Euthenics 2,1,Gonzales,14840',
      'BSCS 4/1-1,MTH,3:00 PM,4:00 PM,MPH2,,INTE1005,Network Technology 1 (Lec),2,De Torres,14735',
      'BSCS 4/1-1,TF,1:00 PM,3:00 PM,213,,BUSS1013,Technopreneurship,3,Baylen,18119',
      ',T,10:00 AM,11:30 AM,,,,,,,', // Blank continuation row for BUSS1013
    ].join('\n')

    const { rows, errors } = parseCsvText(csvContent)
    expect(errors).toHaveLength(0)

    expect(rows).toHaveLength(6)

    // Verify Row 1
    expect(rows[0].section).toBe('BSCS 4/1-1')
    expect(rows[0].course_code).toBe('STIC1007')
    expect(rows[0].day_of_week_raw).toBe('F')

    // Verify Composite MTH split
    expect(rows[1].course_code).toBe('INTE1005')
    expect(rows[1].day_of_week_raw).toBe('M')
    expect(rows[2].course_code).toBe('INTE1005')
    expect(rows[2].day_of_week_raw).toBe('TH')

    // Verify Continuation Row (Row 4 in CSV, entry index 5)
    const continuationEntry = rows[5]
    expect(continuationEntry.course_code).toBe('BUSS1013') // Forward-filled!
    expect(continuationEntry.section).toBe('BSCS 4/1-1')   // Forward-filled!
    expect(continuationEntry.instructor_name).toBe('Baylen') // Forward-filled!
    expect(continuationEntry.day_of_week_raw).toBe('T')
    expect(continuationEntry.start_time_raw).toBe('10:00 AM')
    expect(continuationEntry.end_time_raw).toBe('11:30 AM')
  })

  it('handles multiple consecutive continuation rows gracefully', () => {
    const csvContent = [
      'COURSE,DAY,START,END,ROOM,COURSE CODE,COURSE TITLE,INSTRUCTORS',
      'BSCS 3/1-1,M,8:00 AM,9:00 AM,101,COSC101,Programming 1,Smith',
      ',W,8:00 AM,9:00 AM,101,,,,',
      ',F,8:00 AM,9:00 AM,101,,,,',
    ].join('\n')

    const { rows, errors } = parseCsvText(csvContent)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(3)

    expect(rows[0].day_of_week_raw).toBe('M')
    expect(rows[1].day_of_week_raw).toBe('W')
    expect(rows[1].course_code).toBe('COSC101')
    expect(rows[1].section).toBe('BSCS 3/1-1')
    expect(rows[1].instructor_name).toBe('Smith')

    expect(rows[2].day_of_week_raw).toBe('F')
    expect(rows[2].course_code).toBe('COSC101')
    expect(rows[2].section).toBe('BSCS 3/1-1')
    expect(rows[2].instructor_name).toBe('Smith')
  })

  it('preserves optional columns like MERGE, UNITS, CLASS NO. without failing', () => {
    const csvContent = [
      'COURSE,DAY,START,END,ROOM,MERGE,COURSE CODE,COURSE TITLE,UNITS,INSTRUCTORS,CLASS NO.,CODE,SECTION CODE',
      'BSBA 111,M,1:00 PM,4:00 PM,301,BSBA 111/112,BUS101,Basic Microeconomics,3,Dela Cruz,99881,CODE1,LC01',
    ].join('\n')

    const { rows, errors } = parseCsvText(csvContent)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(1)
    expect(rows[0].course_code).toBe('BUS101')
    expect(rows[0].section).toBe('BSBA 111')
    expect(rows[0].instructor_name).toBe('Dela Cruz')
    expect(rows[0].units_raw).toBe('3')
  })

  it('treats unit mismatches as non-blocking warnings, allowing upload and post-upload editing', async () => {
    // Mock Supabase client
    const mockSupabase = {
      from: (table: string) => {
        if (table === 'courses') {
          return {
            select: () => ({
              ilike: () => ({
                eq: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: {
                        course_code: 'STIC1007',
                        delivery_mode: 'lecture',
                        approval_status: 'approved',
                        lecture_hours: 3,
                        lab_hours: 0,
                        credit_units: 3, // Catalog says 3 units
                      },
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'facilities') {
          return {
            select: () => ({
              eq: async () => ({
                data: [{ id: 'fac-101', name: 'Room 201', room_number: '201', code: '201' }],
              }),
            }),
          }
        }
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                ilike: () => ({
                  limit: async () => ({
                    data: [{ id: 'usr-1', full_name: 'Gonzales' }],
                  }),
                }),
              }),
            }),
          }
        }
        return {
          select: () => ({
            ilike: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null }),
              }),
            }),
          }),
        }
      },
    } as any

    // Row provides 2 units (mismatched with catalog 3 units)
    const rawRow = {
      row_number: 1,
      course_code: 'STIC1007',
      course_name: 'Euthenics 2',
      section: 'BSCS 4/1-1',
      facility_name: 'Room 201',
      instructor_name: 'Gonzales',
      units_raw: '2',
      day_of_week_raw: 'Friday',
      start_time_raw: '12:00 PM',
      end_time_raw: '3:00 PM',
    }

    const result = await validateAndEnrichEntry(mockSupabase, rawRow)

    // Verification:
    // 1. Errors list MUST be empty (0 errors) -> upload succeeds!
    expect(result.validation_errors).toHaveLength(0)
    // 2. Status MUST be 'warning' (yellow warning badge)
    expect(result.validation_status).toBe('warning')
    // 3. Contains UNIT_MISMATCH warning
    expect(result.validation_warnings.some(w => w.code === 'UNIT_MISMATCH')).toBe(true)
  })

  it('parses dynamic day combinations (MF, MT, MWF, TTH, MTH, TF, WF, MW) and sums total hours', () => {
    const csvContent = [
      'COURSE,DAY,START,END,ROOM,COURSE CODE,COURSE TITLE,UNITS,INSTRUCTORS',
      'BSCS 1-1,MF,8:00 AM,9:30 AM,301,COSC101,Computer Programming 1,3,Smith',
      'BSCS 1-2,MT,1:00 PM,2:30 PM,302,COSC102,Computer Programming 2,3,Jones',
    ].join('\n')

    const { rows, errors } = parseCsvText(csvContent)
    expect(errors).toHaveLength(0)

    // MF splits into M and F (2 entries)
    // MT splits into M and T (2 entries)
    expect(rows).toHaveLength(4)

    // MF verification
    expect(rows[0].course_code).toBe('COSC101')
    expect(rows[0].day_of_week_raw).toBe('M')
    expect(rows[1].course_code).toBe('COSC101')
    expect(rows[1].day_of_week_raw).toBe('F')

    // MT verification
    expect(rows[2].course_code).toBe('COSC102')
    expect(rows[2].day_of_week_raw).toBe('M')
    expect(rows[3].course_code).toBe('COSC102')
    expect(rows[3].day_of_week_raw).toBe('T')
  })
})
