-- =====================================================
-- Phase 1.2: Create Booking Facilities Table
-- =====================================================
-- Description: Booking-to-facility assignments (many-to-many)
-- Date: 2026-01-30
-- =====================================================

-- Create booking_facilities junction table
CREATE TABLE IF NOT EXISTS public.booking_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE RESTRICT,
  notes TEXT,
  setup_requirements TEXT, -- Special setup needs for this facility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate facility assignments per booking
  UNIQUE(booking_id, facility_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS booking_facilities_booking_id_idx ON public.booking_facilities(booking_id);
CREATE INDEX IF NOT EXISTS booking_facilities_facility_id_idx ON public.booking_facilities(facility_id);

-- Composite index for conflict detection queries
CREATE INDEX IF NOT EXISTS booking_facilities_facility_booking_idx ON public.booking_facilities(facility_id, booking_id);

-- Enable Row Level Security
ALTER TABLE public.booking_facilities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view facilities for their own bookings
CREATE POLICY "Users can view own booking facilities"
  ON public.booking_facilities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid()
    )
  );

-- Authenticated users can view approved booking facilities (for availability checking)
CREATE POLICY "Authenticated users can view booked facilities"
  ON public.booking_facilities FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.current_status IN ('approved', 'completed')
    )
  );

-- Users can add facilities to their own pending bookings
CREATE POLICY "Users can add facilities to own pending bookings"
  ON public.booking_facilities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.user_id = auth.uid()
        AND b.current_status = 'pending'
    )
  );

-- Service role has full access
CREATE POLICY "Service role can manage booking facilities"
  ON public.booking_facilities FOR ALL
  USING (auth.role() = 'service_role');

-- Function to check facility conflicts
CREATE OR REPLACE FUNCTION public.check_facility_conflict(
  p_facility_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS TABLE(
  conflicting_booking_id UUID,
  booking_reference TEXT,
  conflict_start TIME,
  conflict_end TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as conflicting_booking_id,
    b.booking_reference,
    b.start_time as conflict_start,
    b.end_time as conflict_end
  FROM public.bookings b
  JOIN public.booking_facilities bf ON b.id = bf.booking_id
  WHERE bf.facility_id = p_facility_id
    AND b.booking_date = p_booking_date
    AND b.current_status IN ('pending', 'approved')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (
      -- Check for time overlap
      (p_start_time < b.end_time AND p_end_time > b.start_time)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available facilities for a given date/time
CREATE OR REPLACE FUNCTION public.get_available_facilities(
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_facility_type_id UUID DEFAULT NULL
)
RETURNS TABLE(
  facility_id UUID,
  facility_code TEXT,
  facility_name TEXT,
  capacity INTEGER,
  floor_name TEXT,
  building_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id as facility_id,
    f.code as facility_code,
    f.name as facility_name,
    f.capacity,
    fl.name as floor_name,
    b.name as building_name
  FROM public.facilities f
  JOIN public.floors fl ON f.floor_id = fl.id
  JOIN public.buildings b ON fl.building_id = b.id
  WHERE f.is_active = true
    AND f.is_bookable = true
    AND f.status = 'available'
    AND (p_facility_type_id IS NULL OR f.facility_type_id = p_facility_type_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.check_facility_conflict(f.id, p_booking_date, p_start_time, p_end_time)
    )
  ORDER BY b.name, fl.floor_number, f.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.booking_facilities IS 'Junction table linking bookings to facilities';
COMMENT ON FUNCTION public.check_facility_conflict IS 'Check if a facility has conflicting bookings for given date/time';
COMMENT ON FUNCTION public.get_available_facilities IS 'Get all available facilities for a given date and time range';
