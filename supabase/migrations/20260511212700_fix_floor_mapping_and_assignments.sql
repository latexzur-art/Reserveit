-- =====================================================
-- Migration: Fix Floor Mapping and Facility Assignments
-- Date: 2026-05-11
-- Description: Corrects floor names to include Mezzanine and reassigns facilities to correct floors.
-- =====================================================

DO $$
DECLARE
  main_building_id UUID;
BEGIN
  -- 1. Get the main building ID
  SELECT id INTO main_building_id FROM public.buildings WHERE code = 'MAIN' LIMIT 1;

  IF main_building_id IS NOT NULL THEN
    -- 2. Update Floor names and ensure 6 floors exist
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

    -- 3. Reassign facilities to the correct floor IDs based on room numbers
    -- We use a CASE statement to determine the correct floor_number for each room
    UPDATE public.facilities f
    SET floor_id = fl.id
    FROM public.floors fl
    WHERE fl.building_id = main_building_id 
    AND fl.floor_number = (
      CASE 
        WHEN f.room_number LIKE '5%' OR f.room_number = 'MPH3' THEN 6 -- 5th Floor
        WHEN f.room_number LIKE '4%' OR f.room_number = 'Library' THEN 5 -- 4th Floor
        WHEN f.room_number LIKE '3%' THEN 4 -- 3rd Floor
        WHEN f.room_number LIKE '2%' OR f.room_number = 'CR' THEN 3 -- 2nd Floor
        WHEN f.room_number = 'MPH2' OR f.room_number = 'M01' THEN 2 -- Mezzanine
        WHEN f.room_number IN ('103', '104', 'MPH1', 'GYM') THEN 1 -- 1st Floor
        ELSE (SELECT floor_number FROM public.floors WHERE id = f.floor_id) -- Fallback to current floor number
      END
    );
  END IF;
END $$;
