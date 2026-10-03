-- =====================================================
-- Phase 1.2: Create Facility Amenity Map Table
-- =====================================================
-- Description: Many-to-many relationship between facilities and amenities
-- Date: 2026-01-29
-- =====================================================

-- Create facility_amenity_map junction table
CREATE TABLE IF NOT EXISTS public.facility_amenity_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  amenity_id UUID NOT NULL REFERENCES public.facility_amenities(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1, -- Number of this amenity in the facility
  notes TEXT, -- Additional notes about this amenity in this facility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate mappings
  UNIQUE(facility_id, amenity_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS facility_amenity_map_facility_id_idx ON public.facility_amenity_map(facility_id);
CREATE INDEX IF NOT EXISTS facility_amenity_map_amenity_id_idx ON public.facility_amenity_map(amenity_id);

-- Enable Row Level Security
ALTER TABLE public.facility_amenity_map ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read facility amenity mappings
CREATE POLICY "Anyone can view facility amenities"
  ON public.facility_amenity_map FOR SELECT
  USING (true);

-- Service role can manage mappings
CREATE POLICY "Service role can manage facility amenity mappings"
  ON public.facility_amenity_map FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_facility_amenity_map_updated_at
  BEFORE UPDATE ON public.facility_amenity_map
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Assign common amenities to facilities
-- This assigns standard amenities based on facility type
DO $$
DECLARE
  facility_record RECORD;
  amenity_projector UUID;
  amenity_screen UUID;
  amenity_whiteboard UUID;
  amenity_ac UUID;
  amenity_wifi UUID;
  amenity_chairs UUID;
  amenity_tables UUID;
  amenity_computers UUID;
  amenity_sound UUID;
  amenity_mic UUID;
  amenity_power UUID;
BEGIN
  -- Get amenity IDs
  SELECT id INTO amenity_projector FROM public.facility_amenities WHERE name = 'projector';
  SELECT id INTO amenity_screen FROM public.facility_amenities WHERE name = 'screen';
  SELECT id INTO amenity_whiteboard FROM public.facility_amenities WHERE name = 'whiteboard';
  SELECT id INTO amenity_ac FROM public.facility_amenities WHERE name = 'air_conditioning';
  SELECT id INTO amenity_wifi FROM public.facility_amenities WHERE name = 'wifi';
  SELECT id INTO amenity_chairs FROM public.facility_amenities WHERE name = 'chairs';
  SELECT id INTO amenity_tables FROM public.facility_amenities WHERE name = 'tables';
  SELECT id INTO amenity_computers FROM public.facility_amenities WHERE name = 'computers';
  SELECT id INTO amenity_sound FROM public.facility_amenities WHERE name = 'sound_system';
  SELECT id INTO amenity_mic FROM public.facility_amenities WHERE name = 'microphone';
  SELECT id INTO amenity_power FROM public.facility_amenities WHERE name = 'power_outlets';

  -- Loop through all facilities and assign appropriate amenities
  FOR facility_record IN SELECT f.id, f.code, f.capacity, ft.name as type_name
                         FROM public.facilities f
                         JOIN public.facility_types ft ON f.facility_type_id = ft.id
  LOOP
    -- All facilities get basic amenities
    INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
      (facility_record.id, amenity_ac, 1),
      (facility_record.id, amenity_wifi, 1),
      (facility_record.id, amenity_power, GREATEST(4, facility_record.capacity / 10))
    ON CONFLICT (facility_id, amenity_id) DO NOTHING;

    -- Classrooms get standard classroom amenities
    IF facility_record.type_name = 'classroom' THEN
      INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
        (facility_record.id, amenity_projector, 1),
        (facility_record.id, amenity_screen, 1),
        (facility_record.id, amenity_whiteboard, 2),
        (facility_record.id, amenity_chairs, facility_record.capacity),
        (facility_record.id, amenity_tables, facility_record.capacity / 2)
      ON CONFLICT (facility_id, amenity_id) DO NOTHING;
    END IF;

    -- Computer labs get computers
    IF facility_record.type_name = 'computer_lab' THEN
      INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
        (facility_record.id, amenity_projector, 1),
        (facility_record.id, amenity_screen, 1),
        (facility_record.id, amenity_whiteboard, 1),
        (facility_record.id, amenity_computers, facility_record.capacity),
        (facility_record.id, amenity_chairs, facility_record.capacity)
      ON CONFLICT (facility_id, amenity_id) DO NOTHING;
    END IF;

    -- Science labs
    IF facility_record.type_name = 'science_lab' THEN
      INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
        (facility_record.id, amenity_projector, 1),
        (facility_record.id, amenity_whiteboard, 2),
        (facility_record.id, amenity_tables, facility_record.capacity / 2),
        (facility_record.id, amenity_chairs, facility_record.capacity)
      ON CONFLICT (facility_id, amenity_id) DO NOTHING;
    END IF;

    -- Conference rooms
    IF facility_record.type_name = 'conference_room' THEN
      INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
        (facility_record.id, amenity_projector, 1),
        (facility_record.id, amenity_screen, 1),
        (facility_record.id, amenity_whiteboard, 1),
        (facility_record.id, amenity_chairs, facility_record.capacity),
        (facility_record.id, amenity_tables, 1)
      ON CONFLICT (facility_id, amenity_id) DO NOTHING;
    END IF;

    -- Auditoriums and multipurpose halls
    IF facility_record.type_name IN ('auditorium', 'multipurpose_hall') THEN
      INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
        (facility_record.id, amenity_projector, 2),
        (facility_record.id, amenity_screen, 2),
        (facility_record.id, amenity_sound, 1),
        (facility_record.id, amenity_mic, 4),
        (facility_record.id, amenity_chairs, facility_record.capacity)
      ON CONFLICT (facility_id, amenity_id) DO NOTHING;
    END IF;

    -- Library rooms
    IF facility_record.type_name = 'library_room' THEN
      INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
        (facility_record.id, amenity_whiteboard, 1),
        (facility_record.id, amenity_chairs, facility_record.capacity),
        (facility_record.id, amenity_tables, facility_record.capacity / 2)
      ON CONFLICT (facility_id, amenity_id) DO NOTHING;
    END IF;

  END LOOP;
END $$;

-- Helper function to get all amenities for a facility
CREATE OR REPLACE FUNCTION public.get_facility_amenities(facility_uuid UUID)
RETURNS TABLE(
  amenity_name TEXT,
  amenity_description TEXT,
  amenity_icon TEXT,
  amenity_category TEXT,
  quantity INTEGER,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fa.name,
    fa.description,
    fa.icon,
    fa.category,
    fam.quantity,
    fam.notes
  FROM public.facility_amenity_map fam
  JOIN public.facility_amenities fa ON fam.amenity_id = fa.id
  WHERE fam.facility_id = facility_uuid
    AND fa.is_active = true
  ORDER BY fa.category, fa.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.facility_amenity_map IS 'Junction table linking facilities to their available amenities';
COMMENT ON COLUMN public.facility_amenity_map.quantity IS 'Number of this amenity available in the facility';
COMMENT ON FUNCTION public.get_facility_amenities(UUID) IS 'Get all amenities for a specific facility';
