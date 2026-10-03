import { describe, it, expect } from 'vitest'
import {
  mismatchedReservationEmail,
  curriculumUploadPendingEmail,
  maintenanceReminderEmail,
  facilityBlockReminderEmail,
} from '@/backend/notifications/emailTemplates'

// ── Template 1: Mismatched Reservation ───────────────────────────────────────

describe('mismatchedReservationEmail', () => {
  const base = {
    bookingReference: 'BK-2026-001',
    requesterName: 'Juan dela Cruz',
    facilityName: 'Laboratory 301',
    bookingDate: 'Monday, April 13, 2026',
    sessionType: 'Lecture',
    facilityCategory: 'Laboratory',
    mismatchFlag: 'SESSION_LECTURE_IN_LAB_MISMATCH',
    purpose: 'IT class lecture',
    score: 55,
    reviewUrl: 'http://localhost:3000/academic/bookings/abc-123',
  }

  it('subject contains booking reference', () => {
    const { subject } = mismatchedReservationEmail(base)
    expect(subject).toContain('BK-2026-001')
  })

  it('subject starts with [ReserveIT] and signals review', () => {
    const { subject } = mismatchedReservationEmail(base)
    expect(subject).toMatch(/^\[ReserveIT\]/)
    expect(subject).toContain('Mismatched Booking')
  })

  it('body contains requester name', () => {
    const { htmlBody } = mismatchedReservationEmail(base)
    expect(htmlBody).toContain('Juan dela Cruz')
  })

  it('body contains facility name', () => {
    const { htmlBody } = mismatchedReservationEmail(base)
    expect(htmlBody).toContain('Laboratory 301')
  })

  it('SESSION_LECTURE_IN_LAB_MISMATCH renders human-readable label', () => {
    const { htmlBody } = mismatchedReservationEmail(base)
    expect(htmlBody).toContain('Lecture session booked in a Laboratory room')
  })

  it('UNRECOGNIZED_CROSS_DEPT_USE renders human-readable label', () => {
    const { htmlBody } = mismatchedReservationEmail({
      ...base,
      mismatchFlag: 'UNRECOGNIZED_CROSS_DEPT_USE',
    })
    expect(htmlBody).toContain('Unrecognized cross-department facility use')
  })

  it('unknown flag falls through to raw flag string', () => {
    const { htmlBody } = mismatchedReservationEmail({
      ...base,
      mismatchFlag: 'SOME_OTHER_FLAG',
    })
    expect(htmlBody).toContain('SOME_OTHER_FLAG')
  })

  it('body contains score', () => {
    const { htmlBody } = mismatchedReservationEmail(base)
    expect(htmlBody).toContain('55')
  })

  it('body contains review URL', () => {
    const { htmlBody } = mismatchedReservationEmail(base)
    expect(htmlBody).toContain('http://localhost:3000/academic/bookings/abc-123')
  })

  it('produces valid HTML with doctype and closing tag', () => {
    const { htmlBody } = mismatchedReservationEmail(base)
    expect(htmlBody).toContain('<!DOCTYPE html>')
    expect(htmlBody).toContain('</html>')
  })
})

// ── Template 2: Curriculum Upload Pending ────────────────────────────────────

describe('curriculumUploadPendingEmail', () => {
  const base = {
    uploadId: 'upload-uuid-123',
    departmentName: 'College of Information Technology',
    termName: '2nd Semester 2025-2026',
    totalEntries: 42,
    uploadedByName: 'Maria Santos',
    submittedAt: 'April 8, 2026 at 09:30 AM',
    reviewUrl: 'http://localhost:3000/academic/curriculum/approval-queue',
  }

  it('subject contains [ReserveIT]', () => {
    const { subject } = curriculumUploadPendingEmail(base)
    expect(subject).toMatch(/^\[ReserveIT\]/)
  })

  it('subject contains department name', () => {
    const { subject } = curriculumUploadPendingEmail(base)
    expect(subject).toContain('College of Information Technology')
  })

  it('subject contains term name', () => {
    const { subject } = curriculumUploadPendingEmail(base)
    expect(subject).toContain('2nd Semester 2025-2026')
  })

  it('body contains total entry count', () => {
    const { htmlBody } = curriculumUploadPendingEmail(base)
    expect(htmlBody).toContain('42')
  })

  it('body contains uploader name', () => {
    const { htmlBody } = curriculumUploadPendingEmail(base)
    expect(htmlBody).toContain('Maria Santos')
  })

  it('body contains review URL', () => {
    const { htmlBody } = curriculumUploadPendingEmail(base)
    expect(htmlBody).toContain('/academic/curriculum/approval-queue')
  })
})

// ── Template 3: Maintenance Reminder ─────────────────────────────────────────

describe('maintenanceReminderEmail', () => {
  const base = {
    targetName: 'Room 301 A/C Unit',
    maintenanceType: 'Preventive',
    scheduledDate: 'Thursday, April 11, 2026',
    technician: 'Pedro Reyes',
  }

  it('subject contains target name', () => {
    const { subject } = maintenanceReminderEmail(base)
    expect(subject).toContain('Room 301 A/C Unit')
  })

  it('subject contains "3 days"', () => {
    const { subject } = maintenanceReminderEmail(base)
    expect(subject).toContain('3 days')
  })

  it('body contains technician name', () => {
    const { htmlBody } = maintenanceReminderEmail(base)
    expect(htmlBody).toContain('Pedro Reyes')
  })

  it('body contains scheduled date', () => {
    const { htmlBody } = maintenanceReminderEmail(base)
    expect(htmlBody).toContain('Thursday, April 11, 2026')
  })

  it('renders Notes row when notes provided', () => {
    const { htmlBody } = maintenanceReminderEmail({
      ...base,
      notes: 'Filter replacement required',
    })
    expect(htmlBody).toContain('Filter replacement required')
  })

  it('omits Notes row when notes not provided', () => {
    const { htmlBody } = maintenanceReminderEmail(base)
    // The word "Notes" should not appear as a table label
    expect(htmlBody).not.toMatch(/>\s*Notes\s*</)
  })
})

// ── Template 4: Facility Block Reminder ──────────────────────────────────────

describe('facilityBlockReminderEmail', () => {
  const base = {
    facilityName: 'AVR 2',
    blockType: 'School Event',
    startTime: 'Mon, Apr 13, 2026, 08:00 AM',
    endTime: '05:00 PM',
  }

  it('subject contains facility name', () => {
    const { subject } = facilityBlockReminderEmail(base)
    expect(subject).toContain('AVR 2')
  })

  it('subject contains "3 days"', () => {
    const { subject } = facilityBlockReminderEmail(base)
    expect(subject).toContain('3 days')
  })

  it('body contains block type', () => {
    const { htmlBody } = facilityBlockReminderEmail(base)
    expect(htmlBody).toContain('School Event')
  })

  it('body contains start time', () => {
    const { htmlBody } = facilityBlockReminderEmail(base)
    expect(htmlBody).toContain('08:00 AM')
  })

  it('renders Reason row when reason provided', () => {
    const { htmlBody } = facilityBlockReminderEmail({
      ...base,
      reason: 'Acquaintance Party',
    })
    expect(htmlBody).toContain('Acquaintance Party')
  })

  it('omits Reason row when reason not provided', () => {
    const { htmlBody } = facilityBlockReminderEmail(base)
    expect(htmlBody).not.toMatch(/>\s*Reason\s*</)
  })
})
