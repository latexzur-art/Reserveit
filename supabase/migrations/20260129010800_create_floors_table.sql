-- =====================================================
-- Phase 1.2: Create Floors Table
-- =====================================================
-- Description: Floor definitions for each building (5 floors per plan)
-- Date: 2026-01-29
-- =====================================================

-- Create floors table
CREATE TABLE IF NOT EXISTS public.floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  floor_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  floor_plan_url TEXT, -- URL to floor plan image
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each building can only have one entry per floor number
  UNIQUE(building_id, floor_number)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS floors_building_id_idx ON public.floors(building_id);
CREATE INDEX IF NOT EXISTS floors_floor_number_idx ON public.floors(floor_number);
CREATE INDEX IF NOT EXISTS floors_is_active_idx ON public.floors(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active floors
CREATE POLICY "Anyone can view active floors"
  ON public.floors FOR SELECT
  USING (is_active = true);

-- Service role can manage floors
CREATE POLICY "Service role can manage floors"
  ON public.floors FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_floors_updated_at
  BEFORE UPDATE ON public.floors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default floors for main building (5 floors as per plan)
-- First, get the main building ID
DO $$
DECLARE
  main_building_id UUID;
BEGIN
  SELECT id INTO main_building_id FROM public.buildings WHERE code = 'MAIN';

  IF main_building_id IS NOT NULL THEN
    INSERT INTO public.floors (building_id, floor_number, name, description) VALUES
      (main_building_id, 1, '1st Floor', 'Main entrance, lobby, and general services'),
      (main_building_id, 2, 'Mezzanine', 'Multipurpose halls and administrative offices'),
      (main_building_id, 3, '2nd Floor', 'Standard classrooms and lecture halls'),
      (main_building_id, 4, '3rd Floor', 'Computer and science laboratories'),
      (main_building_id, 5, '4th Floor', 'Specialized studios and library'),
      (main_building_id, 6, '5th Floor', 'Classrooms and multipurpose halls')
    ON CONFLICT (building_id, floor_number) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = NOW();
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE public.floors IS 'Floor definitions within buildings';
COMMENT ON COLUMN public.floors.floor_number IS 'Floor number (1 = ground floor)';
COMMENT ON COLUMN public.floors.floor_plan_url IS 'URL to floor plan image for visual reference';
