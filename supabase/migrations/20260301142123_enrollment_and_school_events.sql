-- =====================================================
-- Schedule Management Expansion - Enrollment and School Events
-- =====================================================
-- Description:
--   1. Modify facility_blocks constraint to allow 'enrollment'
--   2. Create class_schedule_exceptions table for voiding regular classes during events
-- Date: 2026-03-01
-- =====================================================

-- =====================================================
-- 1. Modify facility_blocks block_type constraint
-- =====================================================
-- In PostgreSQL, to modify a CHECK constraint, we must drop it and recreate it.

-- First, find and drop the existing constraint. 
-- The constraint was likely named 'facility_blocks_block_type_check' automatically.
ALTER TABLE public.facility_blocks
  DROP CONSTRAINT IF EXISTS facility_blocks_block_type_check;

-- Recreate the constraint with the new 'enrollment' option
ALTER TABLE public.facility_blocks
  ADD CONSTRAINT facility_blocks_block_type_check
  CHECK (block_type IN ('admin_block', 'maintenance', 'event_hold', 'enrollment'));

-- =====================================================
-- 2. Create class_schedule_exceptions table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.class_schedule_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.class_schedule_exceptions IS
  'Records specific dates when a recurring class schedule is voided or cancelled (e.g., due to a school event).';

CREATE INDEX IF NOT EXISTS idx_class_schedule_exceptions_schedule
  ON public.class_schedule_exceptions(schedule_id);

CREATE INDEX IF NOT EXISTS idx_class_schedule_exceptions_date
  ON public.class_schedule_exceptions(exception_date);

ALTER TABLE public.class_schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage class schedule exceptions"
  ON public.class_schedule_exceptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view class schedule exceptions"
  ON public.class_schedule_exceptions FOR SELECT
  USING (auth.role() = 'authenticated');
