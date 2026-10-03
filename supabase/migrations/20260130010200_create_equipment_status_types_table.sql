-- =====================================================
-- Phase 1.2: Create Equipment Status Types Table
-- =====================================================
-- Description: Lookup table for equipment statuses
-- Date: 2026-01-30
-- =====================================================

-- Create equipment_status_types table
CREATE TABLE IF NOT EXISTS public.equipment_status_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_code TEXT UNIQUE NOT NULL, -- AVAILABLE, IN_USE, BROKEN, MAINTENANCE
  status_name TEXT NOT NULL,
  description TEXT,
  is_bookable BOOLEAN DEFAULT true, -- False for BROKEN, MAINTENANCE
  color TEXT, -- For UI display (hex color or color name)
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS equipment_status_types_status_code_idx ON public.equipment_status_types(status_code);
CREATE INDEX IF NOT EXISTS equipment_status_types_is_bookable_idx ON public.equipment_status_types(is_bookable);

-- Enable Row Level Security
ALTER TABLE public.equipment_status_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view equipment status types"
  ON public.equipment_status_types FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage equipment status types"
  ON public.equipment_status_types FOR ALL
  USING (auth.role() = 'service_role');

-- Insert default status types
INSERT INTO public.equipment_status_types (status_code, status_name, description, is_bookable, color, sort_order) VALUES
  ('AVAILABLE', 'Available', 'Equipment is available for booking', true, 'green', 1),
  ('IN_USE', 'In Use', 'Equipment is currently being used for a booking', false, 'blue', 2),
  ('RESERVED', 'Reserved', 'Equipment is reserved for an upcoming booking', false, 'orange', 3),
  ('MAINTENANCE', 'Under Maintenance', 'Equipment is being serviced or repaired', false, 'yellow', 4),
  ('BROKEN', 'Broken/Damaged', 'Equipment is non-functional and needs repair', false, 'red', 5),
  ('RETIRED', 'Retired', 'Equipment has been decommissioned', false, 'gray', 6)
ON CONFLICT (status_code) DO UPDATE SET
  status_name = EXCLUDED.status_name,
  description = EXCLUDED.description,
  is_bookable = EXCLUDED.is_bookable,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;

-- Add comments
COMMENT ON TABLE public.equipment_status_types IS 'Lookup table for equipment availability statuses';
COMMENT ON COLUMN public.equipment_status_types.is_bookable IS 'Whether equipment with this status can be booked';
