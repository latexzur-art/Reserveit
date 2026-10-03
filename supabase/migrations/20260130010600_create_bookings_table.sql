-- =====================================================
-- Phase 1.2: Create Bookings Table
-- =====================================================
-- Description: Master booking records
-- Date: 2026-01-30
-- =====================================================

-- Create booking_type enum
DO $$ BEGIN
  CREATE TYPE booking_type AS ENUM ('internal_free', 'internal_paid', 'external_paid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create booking_purpose enum (determines if payment is required)
DO $$ BEGIN
  CREATE TYPE booking_purpose AS ENUM (
    'academic',        -- Classes, lectures, exams (FREE for internal)
    'school_event',    -- School-sponsored events, activities (FREE for internal)
    'department_use',  -- Department meetings, trainings (FREE for internal)
    'personal',        -- Personal events like birthdays, reunions (PAID)
    'commercial',      -- Business events, third-party rentals (PAID)
    'community'        -- Community outreach, external orgs (PAID)
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create booking_status enum
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT UNIQUE NOT NULL, -- Auto-generated: BK-20250129-001
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  booking_type booking_type NOT NULL DEFAULT 'internal_free',
  booking_purpose booking_purpose NOT NULL, -- Determines if FREE or PAID
  booking_date DATE NOT NULL,
  time_slot_id UUID REFERENCES public.time_slots(id) ON DELETE SET NULL, -- If using predefined slots
  start_time TIME NOT NULL, -- Custom time support
  end_time TIME NOT NULL,
  purpose TEXT NOT NULL,
  event_name TEXT, -- Name of the event (optional)
  expected_attendees INTEGER,
  current_status booking_status NOT NULL DEFAULT 'pending',
  requires_payment BOOLEAN DEFAULT false,
  special_requests TEXT, -- Any special requirements
  internal_notes TEXT, -- Admin notes (not visible to user)
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure end_time is after start_time
  CONSTRAINT bookings_valid_times CHECK (end_time > start_time),
  -- Ensure booking_date is not in the past (optional, can be enforced in app)
  CONSTRAINT bookings_future_date CHECK (booking_date >= CURRENT_DATE)
);

-- Add indexes for performance (as specified in Phase 1.4)
CREATE INDEX IF NOT EXISTS bookings_booking_reference_idx ON public.bookings(booking_reference);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_booking_date_idx ON public.bookings(booking_date);
CREATE INDEX IF NOT EXISTS bookings_current_status_idx ON public.bookings(current_status);
CREATE INDEX IF NOT EXISTS bookings_user_created_idx ON public.bookings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_date_status_idx ON public.bookings(booking_date, current_status);
CREATE INDEX IF NOT EXISTS bookings_pending_idx ON public.bookings(current_status) WHERE current_status = 'pending';

-- Enable Row Level Security
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own bookings
CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create bookings
CREATE POLICY "Users can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending bookings
CREATE POLICY "Users can update own pending bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = user_id AND current_status = 'pending')
  WITH CHECK (auth.uid() = user_id);

-- Users can cancel their own pending/approved bookings
CREATE POLICY "Users can cancel own bookings"
  ON public.bookings FOR UPDATE
  USING (
    auth.uid() = user_id AND
    current_status IN ('pending', 'approved')
  );

-- Service role has full access
CREATE POLICY "Service role can manage bookings"
  ON public.bookings FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate booking reference number
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS TEXT AS $$
DECLARE
  today_date TEXT;
  sequence_num INTEGER;
  new_reference TEXT;
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Get the count of bookings created today + 1
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.bookings
  WHERE DATE(created_at) = CURRENT_DATE;

  new_reference := 'BK-' || today_date || '-' || LPAD(sequence_num::TEXT, 3, '0');

  RETURN new_reference;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate booking reference
CREATE OR REPLACE FUNCTION public.set_booking_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_reference IS NULL OR NEW.booking_reference = '' THEN
    NEW.booking_reference := public.generate_booking_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_booking_reference
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_booking_reference();

-- Add foreign key from equipment_status_log to bookings
ALTER TABLE public.equipment_status_log
  ADD CONSTRAINT equipment_status_log_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON TABLE public.bookings IS 'Master booking records for facility reservations';
COMMENT ON COLUMN public.bookings.booking_reference IS 'Auto-generated reference number (BK-YYYYMMDD-NNN)';
COMMENT ON COLUMN public.bookings.booking_type IS 'internal_free: Faculty free booking, internal_paid: Staff paid (e.g., gym), external_paid: External client';
COMMENT ON COLUMN public.bookings.time_slot_id IS 'Reference to predefined time slot (optional if using custom times)';
