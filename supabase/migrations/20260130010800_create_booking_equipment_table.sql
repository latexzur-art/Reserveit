-- =====================================================
-- Phase 1.2: Create Booking Equipment Table
-- =====================================================
-- Description: Equipment requests per booking
-- Date: 2026-01-30
-- =====================================================

-- Create booking_equipment junction table
CREATE TABLE IF NOT EXISTS public.booking_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
  quantity_requested INTEGER NOT NULL DEFAULT 1,
  quantity_approved INTEGER, -- Set when approved (may differ from requested)
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate equipment assignments per booking
  UNIQUE(booking_id, equipment_id),
  -- Ensure positive quantities
  CONSTRAINT booking_equipment_positive_qty CHECK (quantity_requested > 0),
  CONSTRAINT booking_equipment_approved_qty CHECK (quantity_approved IS NULL OR quantity_approved >= 0)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS booking_equipment_booking_id_idx ON public.booking_equipment(booking_id);
CREATE INDEX IF NOT EXISTS booking_equipment_equipment_id_idx ON public.booking_equipment(equipment_id);

-- Enable Row Level Security
ALTER TABLE public.booking_equipment ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view equipment for their own bookings
CREATE POLICY "Users can view own booking equipment"
  ON public.booking_equipment FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid()
    )
  );

-- Authenticated users can view approved booking equipment
CREATE POLICY "Authenticated users can view booked equipment"
  ON public.booking_equipment FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.current_status IN ('approved', 'completed')
    )
  );

-- Users can add equipment to their own pending bookings
CREATE POLICY "Users can add equipment to own pending bookings"
  ON public.booking_equipment FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.user_id = auth.uid()
        AND b.current_status = 'pending'
    )
  );

-- Users can update equipment on their own pending bookings
CREATE POLICY "Users can update equipment on own pending bookings"
  ON public.booking_equipment FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.user_id = auth.uid()
        AND b.current_status = 'pending'
    )
  );

-- Service role has full access
CREATE POLICY "Service role can manage booking equipment"
  ON public.booking_equipment FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_booking_equipment_updated_at
  BEFORE UPDATE ON public.booking_equipment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check equipment availability
CREATE OR REPLACE FUNCTION public.check_equipment_availability(
  p_equipment_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_bookable BOOLEAN;
  v_conflict_count INTEGER;
BEGIN
  -- Check if equipment is in a bookable status
  SELECT est.is_bookable INTO v_is_bookable
  FROM public.equipment e
  JOIN public.equipment_status_types est ON e.current_status_id = est.id
  WHERE e.id = p_equipment_id AND e.is_active = true;

  IF v_is_bookable IS NULL OR NOT v_is_bookable THEN
    RETURN false;
  END IF;

  -- Check for conflicting bookings
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.bookings b
  JOIN public.booking_equipment be ON b.id = be.booking_id
  WHERE be.equipment_id = p_equipment_id
    AND b.booking_date = p_booking_date
    AND b.current_status IN ('pending', 'approved')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (p_start_time < b.end_time AND p_end_time > b.start_time);

  RETURN v_conflict_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available equipment by type
CREATE OR REPLACE FUNCTION public.get_available_equipment(
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_equipment_type_id UUID DEFAULT NULL
)
RETURNS TABLE(
  equipment_id UUID,
  equipment_code TEXT,
  equipment_name TEXT,
  type_name TEXT,
  brand TEXT,
  model TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id as equipment_id,
    e.equipment_code,
    e.equipment_name,
    et.type_name,
    e.brand,
    e.model
  FROM public.equipment e
  JOIN public.equipment_types et ON e.equipment_type_id = et.id
  JOIN public.equipment_status_types est ON e.current_status_id = est.id
  WHERE e.is_active = true
    AND est.is_bookable = true
    AND (p_equipment_type_id IS NULL OR e.equipment_type_id = p_equipment_type_id)
    AND public.check_equipment_availability(e.id, p_booking_date, p_start_time, p_end_time)
  ORDER BY et.type_name, e.equipment_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.booking_equipment IS 'Equipment requests linked to bookings';
COMMENT ON COLUMN public.booking_equipment.quantity_approved IS 'May differ from requested if not all available';
COMMENT ON FUNCTION public.check_equipment_availability IS 'Check if specific equipment is available for date/time';
COMMENT ON FUNCTION public.get_available_equipment IS 'Get all available equipment for a given date and time range';
