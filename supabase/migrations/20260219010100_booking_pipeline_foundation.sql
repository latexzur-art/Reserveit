-- =====================================================
-- Booking Pipeline Foundation Migration
-- =====================================================
-- Description: Adds approval engine enums, extends existing tables,
--              and creates pipeline-specific tables with seed data.
-- Date: 2026-02-19
-- =====================================================

-- =====================================================
-- SECTION 1: New Enum Types
-- =====================================================

DO $$ BEGIN
  CREATE TYPE cancellation_type AS ENUM (
    'user_cancelled',
    'admin_cancelled',
    'facility_unavailable',
    'schedule_conflict',
    'payment_timeout',
    'force_majeure'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE override_action AS ENUM ('cancel', 'reschedule', 'change_facility');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE constraint_type AS ENUM ('hard', 'soft');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE constraint_category AS ENUM ('requester', 'booking', 'facility', 'temporal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE facility_tier AS ENUM ('standard', 'premium', 'specialized');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE restriction_action AS ENUM (
    'auto_restricted',
    'manually_restricted',
    'restriction_lifted',
    'restriction_extended',
    'probation_started',
    'probation_ended'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- SECTION 2: Extend booking_status enum
-- =====================================================

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'auto_approved';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'auto_declined';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'flagged';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'overridden';

-- =====================================================
-- SECTION 3: Extend users table
-- =====================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS consecutive_cancellations INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS restricted_reason TEXT,
  ADD COLUMN IF NOT EXISTS restriction_lifted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS restriction_lifted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS appeal_reason TEXT,
  ADD COLUMN IF NOT EXISTS appeal_submitted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS probation_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS probation_lifted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS probation_lifted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS self_facilitation_confirmed BOOLEAN;

-- Extend account_status CHECK to include restricted and probation
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_status_check;
ALTER TABLE public.users ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('pending', 'active', 'suspended', 'inactive', 'restricted', 'probation'));

CREATE INDEX IF NOT EXISTS idx_users_account_status_restricted
  ON public.users(account_status)
  WHERE account_status = 'restricted';

CREATE INDEX IF NOT EXISTS idx_users_account_status_probation
  ON public.users(account_status)
  WHERE account_status = 'probation';

-- =====================================================
-- SECTION 4: Extend facilities table
-- =====================================================

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS facility_tier facility_tier NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS buffer_time INTERVAL DEFAULT '15 minutes',
  ADD COLUMN IF NOT EXISTS advance_booking_days INTEGER DEFAULT 14,
  ADD COLUMN IF NOT EXISTS min_booking_duration INTERVAL DEFAULT '30 minutes',
  ADD COLUMN IF NOT EXISTS max_booking_duration INTERVAL DEFAULT '4 hours',
  ADD COLUMN IF NOT EXISTS always_requires_approval BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS restricted_notes TEXT;

-- =====================================================
-- SECTION 5: Extend bookings table
-- =====================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancellation_type cancellation_type,
  ADD COLUMN IF NOT EXISTS decision_score INTEGER,
  ADD COLUMN IF NOT EXISTS oversight_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS self_facilitation_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS facilitator_name TEXT;

-- NOTE: Partial indexes using new enum values (auto_approved, flagged) are deferred
-- to 20260219010200_booking_pipeline_partial_indexes.sql to avoid the PostgreSQL
-- restriction on using newly-added enum values in the same transaction.

-- =====================================================
-- SECTION 6: Extend notifications table
-- =====================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS email_error TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- =====================================================
-- SECTION 7: Create approval_constraint_rules table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.approval_constraint_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  constraint_type constraint_type NOT NULL,
  constraint_category constraint_category NOT NULL,
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'internal', 'external')),
  -- Hard constraint fields
  is_reroutable BOOLEAN DEFAULT false,
  rejection_message TEXT,
  -- Soft constraint fields
  point_value INTEGER DEFAULT 0,
  condition_field TEXT,
  condition_operator TEXT,
  condition_value TEXT,
  -- Control fields
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100,
  bypass_auto BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_constraint_rules_type_active
  ON public.approval_constraint_rules(constraint_type, is_active);

CREATE INDEX IF NOT EXISTS idx_constraint_rules_priority
  ON public.approval_constraint_rules(priority);

ALTER TABLE public.approval_constraint_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage constraint rules"
  ON public.approval_constraint_rules FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read constraint rules"
  ON public.approval_constraint_rules FOR SELECT
  USING (auth.role() = 'authenticated');

-- =====================================================
-- SECTION 8: Create booking_decisions table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.booking_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  hard_constraints_passed BOOLEAN NOT NULL,
  hard_constraint_failed_code TEXT,
  hard_constraint_details JSONB DEFAULT '{}',
  base_score INTEGER DEFAULT 100,
  score_adjustments JSONB DEFAULT '[]',
  final_score INTEGER,
  decision TEXT NOT NULL,
  decision_reason TEXT,
  pipeline_version TEXT DEFAULT '1.0',
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_decisions_booking_id
  ON public.booking_decisions(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_decisions_created_at
  ON public.booking_decisions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_decisions_decision
  ON public.booking_decisions(decision);

ALTER TABLE public.booking_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage booking decisions"
  ON public.booking_decisions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own booking decisions"
  ON public.booking_decisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can view all decisions"
  ON public.booking_decisions FOR SELECT
  USING (auth.role() = 'authenticated');

-- =====================================================
-- SECTION 9: Create booking_overrides table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.booking_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  override_action override_action NOT NULL,
  original_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  reason TEXT NOT NULL,
  overridden_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  remaining_window_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_overrides_booking_id
  ON public.booking_overrides(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_overrides_overridden_by
  ON public.booking_overrides(overridden_by);

ALTER TABLE public.booking_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage booking overrides"
  ON public.booking_overrides FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view booking overrides"
  ON public.booking_overrides FOR SELECT
  USING (auth.role() = 'authenticated');

-- =====================================================
-- SECTION 10: Create restriction_logs table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.restriction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action restriction_action NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cancellation_count INTEGER DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restriction_logs_user_id
  ON public.restriction_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_restriction_logs_created_at
  ON public.restriction_logs(created_at DESC);

ALTER TABLE public.restriction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage restriction logs"
  ON public.restriction_logs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view restriction logs"
  ON public.restriction_logs FOR SELECT
  USING (auth.role() = 'authenticated');

-- =====================================================
-- SECTION 11: Create facility_blocks table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.facility_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL DEFAULT 'admin_block'
    CHECK (block_type IN ('admin_block', 'maintenance', 'event_hold')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern JSONB,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT facility_blocks_valid_times CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_facility_blocks_facility_id
  ON public.facility_blocks(facility_id);

CREATE INDEX IF NOT EXISTS idx_facility_blocks_time_range
  ON public.facility_blocks(facility_id, start_time, end_time);

ALTER TABLE public.facility_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage facility blocks"
  ON public.facility_blocks FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view facility blocks"
  ON public.facility_blocks FOR SELECT
  USING (auth.role() = 'authenticated');

-- =====================================================
-- SECTION 12: Seed approval_constraint_rules
-- Hard Constraints (16 rules)
-- =====================================================

INSERT INTO public.approval_constraint_rules
  (code, name, description, constraint_type, constraint_category, applies_to,
   is_reroutable, rejection_message, is_active, priority, bypass_auto)
VALUES
  (
    'USER_RESTRICTED',
    'User Account Restricted',
    'User account is restricted due to excessive cancellations',
    'hard', 'requester', 'all',
    false,
    'Your account has been restricted. Please contact the building administrator.',
    true, 1, true
  ),
  (
    'CLASS_CONFLICT',
    'Class Schedule Conflict',
    'Facility has a scheduled class at the requested time',
    'hard', 'facility', 'all',
    true,
    'This facility is occupied by a scheduled class at the requested time.',
    true, 2, false
  ),
  (
    'BOOKING_CONFLICT',
    'Existing Booking Conflict',
    'Facility already has an approved booking at the requested time',
    'hard', 'facility', 'all',
    true,
    'This facility is already booked at the requested time.',
    true, 3, false
  ),
  (
    'EQUIPMENT_CONFLICT',
    'Equipment Already Booked',
    'Requested equipment is already reserved for another booking',
    'hard', 'booking', 'all',
    true,
    'One or more requested equipment items are unavailable at the requested time.',
    true, 4, false
  ),
  (
    'BUFFER_VIOLATION',
    'Buffer Time Violation',
    'Booking is too close to an adjacent booking (buffer time not respected)',
    'hard', 'facility', 'all',
    true,
    'Insufficient buffer time between this booking and an adjacent booking.',
    true, 5, false
  ),
  (
    'ADMIN_BLOCK',
    'Facility Admin Block',
    'Facility has been blocked by administrator at the requested time',
    'hard', 'facility', 'all',
    true,
    'This facility has been blocked by the administrator at the requested time.',
    true, 6, false
  ),
  (
    'OUTSIDE_HOURS',
    'Outside Operating Hours',
    'Booking falls outside the building operating hours',
    'hard', 'temporal', 'all',
    true,
    'The requested time is outside building operating hours (7:00 AM - 9:00 PM).',
    true, 7, false
  ),
  (
    'CAPACITY_EXCEEDED',
    'Capacity Exceeded',
    'Number of attendees exceeds the facility maximum capacity',
    'hard', 'facility', 'all',
    true,
    'The number of expected attendees exceeds this facility''s capacity.',
    true, 8, false
  ),
  (
    'UNDER_MAINTENANCE',
    'Facility Under Maintenance',
    'Facility status is set to maintenance',
    'hard', 'facility', 'all',
    true,
    'This facility is currently under maintenance.',
    true, 9, false
  ),
  (
    'EXAM_PERIOD_BLOCK',
    'Exam Period Block',
    'External bookings are not allowed during exam periods',
    'hard', 'temporal', 'external',
    true,
    'External bookings are not permitted during the examination period.',
    true, 10, false
  ),
  (
    'ENROLLMENT_BLOCK',
    'Enrollment Period Block',
    'External bookings are not allowed during enrollment periods',
    'hard', 'temporal', 'external',
    true,
    'External bookings are not permitted during the enrollment period.',
    true, 11, false
  ),
  (
    'ADVANCE_LIMIT',
    'Advance Booking Limit',
    'Booking is made too far in advance beyond the facility limit',
    'hard', 'temporal', 'all',
    false,
    'This booking is too far in advance. Please book within the allowed advance booking window.',
    true, 12, false
  ),
  (
    'DURATION_VIOLATION',
    'Duration Violation',
    'Booking duration is outside the allowed min/max range for this facility',
    'hard', 'booking', 'all',
    false,
    'The booking duration does not meet this facility''s requirements (30 minutes to 4 hours).',
    true, 13, false
  ),
  (
    'PURPOSE_MISMATCH',
    'Purpose-Facility Mismatch',
    'Booking purpose does not match the facility''s specialization',
    'hard', 'booking', 'all',
    true,
    'The booking purpose does not match this facility''s designated use.',
    true, 14, false
  ),
  (
    'EVENT_IN_CLASSROOM',
    'Event in Classroom Not Allowed',
    'Events cannot be held in classrooms; must use designated event venues',
    'hard', 'booking', 'all',
    true,
    'Events cannot be held in classrooms. Please use the MPH, Auditorium, Library, or 5th floor venues.',
    true, 15, false
  ),
  (
    'RESTRICTED_FACILITY',
    'Restricted Facility',
    'Facility always requires special approval (e.g., Lab 401)',
    'hard', 'facility', 'all',
    false,
    'This facility requires special approval. Your booking has been routed for manual review.',
    true, 16, true
  )
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- SECTION 13: Seed approval_constraint_rules
-- Soft Constraints (21 rules)
-- =====================================================

INSERT INTO public.approval_constraint_rules
  (code, name, description, constraint_type, constraint_category, applies_to,
   point_value, condition_field, condition_operator, condition_value,
   is_active, priority)
VALUES
  -- Requester factors
  (
    'REQ_FACULTY', 'Faculty Requester', 'Booking made by faculty member',
    'soft', 'requester', 'internal',
    15, 'user_role', 'in', 'faculty,program_head,academic_head',
    true, 101
  ),
  (
    'REQ_PROGRAM_HEAD', 'Program Head Requester', 'Booking made by a program head',
    'soft', 'requester', 'internal',
    20, 'user_role', 'equals', 'program_head',
    true, 102
  ),
  (
    'REQ_EXTERNAL', 'External Requester', 'Booking made by an external client',
    'soft', 'requester', 'external',
    -15, 'user_type', 'equals', 'external',
    true, 103
  ),
  (
    'REQ_FIRST_TIME', 'First-Time Requester', 'User has fewer than 2 previous bookings',
    'soft', 'requester', 'all',
    -10, 'booking_count', 'less_than', '2',
    true, 104
  ),
  (
    'REQ_EXPERIENCED', 'Experienced Requester', 'User has 10 or more previous bookings',
    'soft', 'requester', 'all',
    10, 'booking_count', 'greater_than_or_equal', '10',
    true, 105
  ),
  (
    'REQ_HIGH_CANCEL', 'High Cancellation Rate', 'User cancellation rate exceeds 20%',
    'soft', 'requester', 'all',
    -25, 'cancellation_rate', 'greater_than', '0.20',
    true, 106
  ),
  (
    'REQ_VIOLATIONS', 'Previous Violations', 'User has previous booking violations',
    'soft', 'requester', 'all',
    -30, 'violation_count', 'greater_than', '0',
    true, 107
  ),
  (
    'REQ_UNPAID', 'Unpaid Balance', 'User has an outstanding unpaid balance',
    'soft', 'requester', 'all',
    -20, 'has_unpaid_balance', 'equals', 'true',
    true, 108
  ),
  -- Booking factors
  (
    'BOOK_ACADEMIC', 'Academic Purpose', 'Booking purpose is academic',
    'soft', 'booking', 'all',
    15, 'booking_purpose', 'equals', 'academic',
    true, 109
  ),
  (
    'BOOK_COMMERCIAL', 'Commercial Purpose', 'Booking purpose is commercial',
    'soft', 'booking', 'all',
    -10, 'booking_purpose', 'equals', 'commercial',
    true, 110
  ),
  (
    'BOOK_WEEKEND', 'Weekend Booking', 'Booking falls on a weekend',
    'soft', 'booking', 'all',
    -10, 'booking_day_of_week', 'in', '0,6',
    true, 111
  ),
  (
    'BOOK_EVENING', 'Evening Booking', 'Booking start time is after 18:00',
    'soft', 'booking', 'all',
    -5, 'start_time_hour', 'greater_than_or_equal', '18',
    true, 112
  ),
  (
    'BOOK_LONG', 'Long Duration Booking', 'Booking duration exceeds 4 hours',
    'soft', 'booking', 'all',
    -10, 'booking_duration_hours', 'greater_than', '4',
    true, 113
  ),
  (
    'BOOK_SAME_DAY', 'Same-Day Booking', 'Booking is made for today',
    'soft', 'booking', 'all',
    -15, 'days_until_booking', 'equals', '0',
    true, 114
  ),
  -- Facility factors
  (
    'FAC_STANDARD', 'Standard Facility', 'Booking is for a standard-tier facility',
    'soft', 'facility', 'all',
    10, 'facility_tier', 'equals', 'standard',
    true, 115
  ),
  (
    'FAC_PREMIUM', 'Premium Facility', 'Booking is for a premium-tier facility',
    'soft', 'facility', 'all',
    -15, 'facility_tier', 'equals', 'premium',
    true, 116
  ),
  (
    'FAC_LAB', 'Laboratory Facility', 'Booking is for a laboratory',
    'soft', 'facility', 'all',
    -10, 'facility_type_name', 'contains', 'lab',
    true, 117
  ),
  (
    'FAC_HIGH_EQUIP', 'High Equipment Value', 'Booking includes high-value equipment',
    'soft', 'facility', 'all',
    -10, 'equipment_count', 'greater_than', '3',
    true, 118
  ),
  -- Temporal factors
  (
    'TEMP_EXAM', 'Exam Period', 'Booking falls during exam period',
    'soft', 'temporal', 'all',
    -20, 'is_exam_period', 'equals', 'true',
    true, 119
  ),
  (
    'TEMP_ENROLLMENT', 'Enrollment Period', 'Booking falls during enrollment period',
    'soft', 'temporal', 'all',
    -15, 'is_enrollment_period', 'equals', 'true',
    true, 120
  ),
  (
    'TEMP_BREAK', 'Semester Break', 'Booking falls during semester break',
    'soft', 'temporal', 'all',
    10, 'is_semester_break', 'equals', 'true',
    true, 121
  )
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- SECTION 14: Classify existing facilities by tier
-- =====================================================

-- Standard tier: classrooms, lecture halls, seminar rooms
UPDATE public.facilities
SET facility_tier = 'standard'
WHERE id IN (
  SELECT f.id FROM public.facilities f
  JOIN public.facility_types ft ON f.facility_type_id = ft.id
  WHERE LOWER(ft.name) ILIKE ANY(ARRAY['%classroom%', '%lecture%', '%seminar%', '%room%'])
);

-- Premium tier: gymnasium, AVR, conference rooms, auditorium, MPH, library
UPDATE public.facilities
SET facility_tier = 'premium'
WHERE id IN (
  SELECT f.id FROM public.facilities f
  JOIN public.facility_types ft ON f.facility_type_id = ft.id
  WHERE LOWER(ft.name) ILIKE ANY(ARRAY['%gym%', '%avr%', '%conference%', '%auditorium%', '%multi%', '%library%'])
);

-- Specialized tier: computer labs, science labs, kitchen labs
UPDATE public.facilities
SET facility_tier = 'specialized'
WHERE id IN (
  SELECT f.id FROM public.facilities f
  JOIN public.facility_types ft ON f.facility_type_id = ft.id
  WHERE LOWER(ft.name) ILIKE ANY(ARRAY['%lab%', '%kitchen%', '%studio%', '%workshop%'])
);

-- Mark Lab 401 as always requiring approval (restricted facility)
UPDATE public.facilities
SET always_requires_approval = true,
    restricted_notes = 'Lab 401 requires SAO coordination. Multimedia department priority.'
WHERE LOWER(name) LIKE '%lab 401%' OR LOWER(name) LIKE '%laboratory 401%';

-- =====================================================
-- SECTION 15: Add comments
-- =====================================================

COMMENT ON TABLE public.approval_constraint_rules IS 'Configuration for all hard and soft booking constraints';
COMMENT ON TABLE public.booking_decisions IS 'Full scoring breakdown record for every processed booking';
COMMENT ON TABLE public.booking_overrides IS 'Admin interventions during the 48-hour oversight window';
COMMENT ON TABLE public.restriction_logs IS 'Audit trail for user restriction lifecycle events';
COMMENT ON TABLE public.facility_blocks IS 'Time-specific admin blocks on facilities (maintenance, events, etc.)';

COMMENT ON COLUMN public.bookings.oversight_expires_at IS '48-hour admin oversight window expiry; NULL until pipeline processes';
COMMENT ON COLUMN public.bookings.decision_score IS 'Final soft constraint score (0-100); NULL for non-auto-processed bookings';
COMMENT ON COLUMN public.users.consecutive_cancellations IS 'Resets to 0 on booking completion; triggers restriction at 3';
COMMENT ON COLUMN public.facilities.facility_tier IS 'standard=classrooms, premium=AVR/gym, specialized=labs';
COMMENT ON COLUMN public.facilities.always_requires_approval IS 'If true, bypass_auto forces manual review regardless of score';
