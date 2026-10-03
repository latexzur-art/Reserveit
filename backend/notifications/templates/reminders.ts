import { wrapEmailLayout, row, tableWrap } from './shared'

export function maintenanceReminderEmail(data: {
  targetName: string
  maintenanceType: string
  scheduledDate: string
  technician: string
  notes?: string
}): { subject: string; htmlBody: string } {
  const notesRow = data.notes ? row('Notes', data.notes) : ''

  const body = `
    <p style="color:#555;line-height:1.6;">
      A maintenance activity is <strong>scheduled in 3 days</strong>. Please ensure the affected facility or equipment is available and any bookings during this period have been addressed.
    </p>
    ${tableWrap(
      row('Target', data.targetName) +
      row('Type', data.maintenanceType) +
      row('Scheduled Date', `<span style="color:#e85000;font-weight:bold;">${data.scheduledDate}</span>`) +
      row('Technician', data.technician) +
      notesRow
    )}`

  return {
    subject: `[ReserveIT] Maintenance Reminder — ${data.targetName} in 3 days (${data.scheduledDate})`,
    htmlBody: wrapEmailLayout('Upcoming Maintenance — 3-Day Reminder', body),
  }
}

// ── Immediate Maintenance Notification (Sent on Creation) ────────────────────

export function immediateMaintenanceNotificationEmail(data: {
  targetName: string
  maintenanceType: string
  scheduledDate: string
  technician: string
  notes?: string
}): { subject: string; htmlBody: string } {
  const notesRow = data.notes ? row('Notes', data.notes) : ''

  const body = `
    <p style="color:#555;line-height:1.6;">
      The Building Administrator has scheduled a <strong>new maintenance block</strong>. Any affected facility or equipment will be unavailable during this date.
    </p>
    ${tableWrap(
      row('Target', data.targetName) +
      row('Type', data.maintenanceType) +
      row('Scheduled Date', `<span style="color:#e85000;font-weight:bold;">${data.scheduledDate}</span>`) +
      row('Technician', data.technician) +
      notesRow
    )}`

  return {
    subject: `[ACTION TAKEN] New Maintenance Block Scheduled — ${data.targetName} on ${data.scheduledDate}`,
    htmlBody: wrapEmailLayout('Maintenance Block Created', body),
  }
}

// ── Template 7: Facility Block / School Event Reminder ──────────────────────

export function facilityBlockReminderEmail(data: {
  facilityName: string
  blockType: string
  reason?: string
  startTime: string
  endTime: string
}): { subject: string; htmlBody: string } {
  const reasonRow = data.reason ? row('Reason', data.reason) : ''

  const body = `
    <p style="color:#555;line-height:1.6;">
      A <strong>facility block or school event</strong> is scheduled in 3 days. This will restrict regular bookings for the affected facility during this period.
    </p>
    ${tableWrap(
      row('Facility', data.facilityName) +
      row('Block Type', data.blockType) +
      row('Start', `<span style="color:#e85000;font-weight:bold;">${data.startTime}</span>`) +
      row('End', data.endTime) +
      reasonRow
    )}`

  return {
    subject: `[ReserveIT] Upcoming Facility Block — ${data.facilityName} in 3 days`,
    htmlBody: wrapEmailLayout('Upcoming Facility Block — 3-Day Reminder', body),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking Lifecycle Templates (sent via Brevo)
// ─────────────────────────────────────────────────────────────────────────────

// ── Email 1: Password Reset (Admin-Sent) ─────────────────────────────────────

export function bookingReminder24hEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  bookingDate: string
  startTime: string
  endTime: string
  duration: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const body = `
    <p style="color:#555;line-height:1.6;">
      Dear <strong>${data.userName + (data.userRole ? ' (' + data.userRole + ')' : '')}</strong>, this is a friendly reminder that you have a booking <strong>tomorrow</strong>!
    </p>
    ${tableWrap(
      row('Facility', data.facilityName) +
      row('Date', `<strong>Tomorrow, ${data.bookingDate}</strong>`) +
      row('Time', `${data.startTime} – ${data.endTime}`) +
      row('Duration', data.duration) +
      row('Reference #', data.bookingRef)
    )}
    <p style="color:#555;line-height:1.6;margin-top:8px;"><strong>Reminders:</strong></p>
    <ul style="color:#555;line-height:1.8;padding-left:20px;">
      <li>Please arrive 5–10 minutes early</li>
      <li>Bring any required ID or access card</li>
      <li>Contact admin if you need to cancel</li>
    </ul>`

  return {
    subject: `Reminder: Your Booking Tomorrow — ${data.facilityName} at ${data.startTime}`,
    htmlBody: wrapEmailLayout('Booking Reminder — Tomorrow', body),
  }
}

// ── Email 7: Booking Reminder — 1 Hour Before ────────────────────────────────

export function bookingReminder1hEmail(data: {
  userName: string
  bookingRef: string
  facilityName: string
  startTime: string
  duration: string
  facilityLocation?: string
  userRole?: string
}): { subject: string; htmlBody: string } {
  const locationRow = data.facilityLocation ? row('Location', data.facilityLocation) : ''

  const body = `
    <p style="color:#555;line-height:1.6;">
      Dear <strong>${data.userName + (data.userRole ? ' (' + data.userRole + ')' : '')}</strong>, your booking starts in approximately <strong>1 hour</strong>!
    </p>
    ${tableWrap(
      row('Facility', data.facilityName) +
      locationRow +
      row('Time', `${data.startTime} (in ~1 hour)`) +
      row('Duration', data.duration) +
      row('Reference #', data.bookingRef)
    )}
    <p style="color:#555;line-height:1.6;margin-top:8px;"><strong>Get Ready:</strong></p>
    <ul style="color:#555;line-height:1.8;padding-left:20px;">
      <li>Gather materials or equipment needed</li>
      <li>Plan your route to the facility</li>
      <li>Arrive a few minutes early</li>
    </ul>`

  return {
    subject: `Your Booking Starts in 1 Hour — ${data.facilityName}`,
    htmlBody: wrapEmailLayout('Booking Reminder — Starting Soon', body),
  }
}

// ── Email 8: Admin Notification — New Pending Booking ────────────────────────
