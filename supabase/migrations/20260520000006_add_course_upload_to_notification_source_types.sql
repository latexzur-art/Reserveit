-- Add 'course_upload' to the notifications.source_type CHECK constraint.
-- Without this, every in-app course-upload notification insert silently fails
-- the constraint and the role fan-out swallows the error in a .catch().

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_source_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_source_type_check CHECK (
    source_type IS NULL OR source_type IN (
      'booking',
      'schedule_upload',
      'schedule_entry',
      'facility_block',
      'broadcast',
      'admin_message',
      'restriction',
      'payment',
      'system',
      'override',
      'message',
      'schedule_conflict',
      'appeal',
      'change_request',
      'maintenance',
      'user',
      'score_reset',
      'score_reset_request',
      'course_upload'
    )
  );
