-- =====================================================
-- Phase 1.2: Create Facility Types Table
-- =====================================================
-- Description: Categorization of facilities (classroom, lab, auditorium, etc.)
-- Date: 2026-01-29
-- =====================================================

-- Create facility_types table
CREATE TABLE IF NOT EXISTS public.facility_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT, -- Icon identifier for UI display
  default_capacity INTEGER,
  requires_approval BOOLEAN DEFAULT true,
  booking_rules JSONB DEFAULT '{}', -- Rules like max duration, advance booking days
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS facility_types_name_idx ON public.facility_types(name);
CREATE INDEX IF NOT EXISTS facility_types_is_active_idx ON public.facility_types(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.facility_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active facility types
CREATE POLICY "Anyone can view active facility types"
  ON public.facility_types FOR SELECT
  USING (is_active = true);

-- Service role can manage facility types
CREATE POLICY "Service role can manage facility types"
  ON public.facility_types FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_facility_types_updated_at
  BEFORE UPDATE ON public.facility_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default facility types
INSERT INTO public.facility_types (name, description, icon, default_capacity, requires_approval, booking_rules) VALUES
  ('classroom', 'Standard classroom for lectures and discussions', 'school', 40, false,
   '{"max_duration_hours": 4, "advance_booking_days": 14, "min_notice_hours": 24}'),
  ('computer_lab', 'Computer laboratory with workstations', 'computer', 30, true,
   '{"max_duration_hours": 4, "advance_booking_days": 14, "min_notice_hours": 48, "requires_it_support": true}'),
  ('science_lab', 'Science laboratory for experiments', 'science', 25, true,
   '{"max_duration_hours": 3, "advance_booking_days": 14, "min_notice_hours": 48, "requires_lab_tech": true}'),
  ('auditorium', 'Large auditorium for events and presentations', 'theater_comedy', 200, true,
   '{"max_duration_hours": 8, "advance_booking_days": 30, "min_notice_hours": 72, "requires_av_support": true}'),
  ('conference_room', 'Meeting and conference room', 'groups', 20, true,
   '{"max_duration_hours": 4, "advance_booking_days": 7, "min_notice_hours": 24}'),
  ('multipurpose_hall', 'Flexible space for various activities', 'celebration', 150, true,
   '{"max_duration_hours": 8, "advance_booking_days": 21, "min_notice_hours": 48}'),
  ('library_room', 'Library study rooms', 'menu_book', 10, false,
   '{"max_duration_hours": 3, "advance_booking_days": 3, "min_notice_hours": 2}'),
  ('gym', 'Gymnasium and sports facility', 'fitness_center', 50, true,
   '{"max_duration_hours": 4, "advance_booking_days": 7, "min_notice_hours": 24}'),
  ('studio', 'Media/Recording studio', 'mic', 15, true,
   '{"max_duration_hours": 4, "advance_booking_days": 7, "min_notice_hours": 48, "requires_media_support": true}'),
  ('outdoor_area', 'Outdoor spaces and grounds', 'park', 100, true,
   '{"max_duration_hours": 8, "advance_booking_days": 14, "min_notice_hours": 72}')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  default_capacity = EXCLUDED.default_capacity,
  requires_approval = EXCLUDED.requires_approval,
  booking_rules = EXCLUDED.booking_rules,
  updated_at = NOW();

-- Add comments
COMMENT ON TABLE public.facility_types IS 'Categories of facilities available for booking';
COMMENT ON COLUMN public.facility_types.icon IS 'Material icon identifier for UI display';
COMMENT ON COLUMN public.facility_types.booking_rules IS 'JSON object with booking constraints (max duration, advance days, notice period)';
