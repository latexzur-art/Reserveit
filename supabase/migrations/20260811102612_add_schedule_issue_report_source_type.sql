-- =====================================================
-- Add schedule_issue_report to notification source_type constraint
-- =====================================================
-- Description: Extends the notifications source_type CHECK constraint to allow
--   'schedule_issue_report' for schedule issue report notifications.
-- Date: 2026-08-11
-- =====================================================

DO $$ BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_source_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_source_type_check
    CHECK (source_type IN (
      'booking', 'booking_reminder', 'schedule_upload', 'schedule_entry', 'schedule',
      'schedule_conflict', 'schedule_change_request', 'facility_block', 'broadcast',
      'admin_message', 'restriction', 'payment', 'system', 'override', 'message',
      'appeal', 'change_request', 'maintenance', 'user', 'score_reset',
      'score_reset_request', 'course_upload', 'emergency_request', 'session_credit',
      'password_reset_request', 'reschedule_offer', 'special_event', 'pending_approval_sla',
      'schedule_issue_report'
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
