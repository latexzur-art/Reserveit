-- DB remediation Phase 1.2 + 1.3 (DATABASE_REMEDIATION_PLAN.md)
-- 1.2: drop the duplicate courses index (idx_courses_approval_status remains
--      and has an identical definition).
-- 1.3: hot-path FK indexes only (10 of the 47 flagged — the rest are
--      rarely-joined audit/metadata columns).
--
-- NOTE: the plan suggests CREATE INDEX CONCURRENTLY, but supabase db push
-- runs migrations inside a transaction where CONCURRENTLY is not allowed.
-- These tables are small (campus-scale), so plain CREATE INDEX with its
-- brief write lock is the pragmatic equivalent here.

DROP INDEX IF EXISTS public.idx_courses_status;

CREATE INDEX IF NOT EXISTS idx_bookings_time_slot_id ON public.bookings(time_slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_cancelled_by_schedule_id ON public.bookings(cancelled_by_schedule_id);
CREATE INDEX IF NOT EXISTS idx_booking_status_history_changed_by ON public.booking_status_history(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_cashier_received_by ON public.payments(cashier_received_by);
CREATE INDEX IF NOT EXISTS idx_payments_refunded_by ON public.payments(refunded_by);
CREATE INDEX IF NOT EXISTS idx_class_schedules_upload_id ON public.class_schedules(schedule_upload_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_superseded_by ON public.class_schedules(superseded_by);
CREATE INDEX IF NOT EXISTS idx_users_created_by ON public.users(created_by);
CREATE INDEX IF NOT EXISTS idx_users_restriction_lifted_by ON public.users(restriction_lifted_by);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_staging_instructor_id ON public.schedule_entries_staging(instructor_id);
