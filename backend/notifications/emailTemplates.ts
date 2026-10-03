/**
 * Email Templates — stable barrel.
 * Implementations live in ./templates/*, grouped by domain
 * (split from the original 2658-line file in the deferred-splits cleanup).
 * Each function returns { subject, htmlBody } for use with sendEmail().
 * @module backend/notifications/emailTemplates
 */

export * from './templates/mismatch'
export * from './templates/curriculum'
export * from './templates/reminders'
export * from './templates/booking-lifecycle'
export * from './templates/schedules'
export * from './templates/payments'
export * from './templates/emergency'
export * from './templates/reschedule'
export * from './templates/credits'
export * from './templates/account'
export * from './templates/special-events'
