-- =====================================================
-- Phase 1.2: Create Buildings Table
-- =====================================================
-- Description: Building registry for multi-building support
-- Date: 2026-01-29
-- =====================================================

-- Create buildings table
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  total_floors INTEGER DEFAULT 1,
  image_url TEXT,
  operating_hours JSONB DEFAULT '{"monday": {"open": "07:00", "close": "21:00"}, "tuesday": {"open": "07:00", "close": "21:00"}, "wednesday": {"open": "07:00", "close": "21:00"}, "thursday": {"open": "07:00", "close": "21:00"}, "friday": {"open": "07:00", "close": "21:00"}, "saturday": {"open": "08:00", "close": "17:00"}, "sunday": null}',
  contact_info JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS buildings_code_idx ON public.buildings(code);
CREATE INDEX IF NOT EXISTS buildings_name_idx ON public.buildings(name);
CREATE INDEX IF NOT EXISTS buildings_is_active_idx ON public.buildings(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active buildings
CREATE POLICY "Anyone can view active buildings"
  ON public.buildings FOR SELECT
  USING (is_active = true);

-- Service role can manage buildings
CREATE POLICY "Service role can manage buildings"
  ON public.buildings FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_buildings_updated_at
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default building (STI Main Building)
INSERT INTO public.buildings (code, name, description, address, total_floors, operating_hours, contact_info) VALUES
  ('MAIN', 'STI Academic Center', 'Main academic building with classrooms, laboratories, and administrative offices',
   'STI College, Your City, Philippines', 5,
   '{"monday": {"open": "07:00", "close": "21:00"}, "tuesday": {"open": "07:00", "close": "21:00"}, "wednesday": {"open": "07:00", "close": "21:00"}, "thursday": {"open": "07:00", "close": "21:00"}, "friday": {"open": "07:00", "close": "21:00"}, "saturday": {"open": "08:00", "close": "17:00"}, "sunday": null}',
   '{"phone": "+63-XXX-XXX-XXXX", "email": "building@sti.edu.ph", "emergency": "+63-XXX-XXX-XXXX"}')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  total_floors = EXCLUDED.total_floors,
  updated_at = NOW();

-- Add comments
COMMENT ON TABLE public.buildings IS 'Building registry for facility management';
COMMENT ON COLUMN public.buildings.code IS 'Unique building identifier code';
COMMENT ON COLUMN public.buildings.total_floors IS 'Number of floors in the building';
COMMENT ON COLUMN public.buildings.operating_hours IS 'JSON object with daily operating hours (null = closed)';
COMMENT ON COLUMN public.buildings.contact_info IS 'JSON object with building contact information';
