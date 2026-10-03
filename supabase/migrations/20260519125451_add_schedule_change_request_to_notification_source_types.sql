-- Add 'schedule_change_request' to the notifications.source_type CHECK constraint.
-- Without this, every schedule-change-request notification (new request fan-out to
-- academic heads, and decision notification to the requester) silently fails the
-- constraint check and is swallowed by the .catch() in sendNotification.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_source_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_source_type_check CHECK (
    source_type IS NULL OR source_type IN (
      'booking',
      'booking_reminder',
      'schedule_upload',
      'schedule_entry',
      'schedule',
      'schedule_conflict',
      'schedule_change_request',
      'facility_block',
      'broadcast',
      'admin_message',
      'restriction',
      'payment',
      'system',
      'override',
      'message',
      'appeal',
      'change_request',
      'maintenance',
      'user',
      'score_reset',
      'score_reset_request',
      'course_upload',
      'emergency_request',
      'session_credit',
      'password_reset_request'
    )
  );
