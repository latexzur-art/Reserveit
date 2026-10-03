-- =====================================================
-- Add Gymnasium Facility
-- =====================================================
-- The gym facility type exists but no actual facility was seeded.
-- Add Gymnasium on the Ground Floor as a premium venue.
-- =====================================================

DO $$
DECLARE
  v_floor_id UUID;
  v_type_gym UUID;
BEGIN
  -- Get ground floor ID
  SELECT id INTO v_floor_id FROM public.floors WHERE floor_number = 1 LIMIT 1;
  -- Get gym facility type
  SELECT id INTO v_type_gym FROM public.facility_types WHERE name = 'gym' LIMIT 1;

  IF v_floor_id IS NULL THEN
    RAISE EXCEPTION 'Ground floor not found';
  END IF;

  IF v_type_gym IS NULL THEN
    RAISE EXCEPTION 'Gym facility type not found';
  END IF;

  INSERT INTO public.facilities (
    code, name, description, floor_id, facility_type_id,
    capacity, area_sqm, room_number, requires_approval,
    facility_tier, always_requires_approval, is_bookable
  ) VALUES (
    'GF-GYM-001',
    'Gymnasium',
    'Main gymnasium for sports, PE classes, and school events',
    v_floor_id,
    v_type_gym,
    200,
    NULL,
    'GYM',
    true,
    'premium',
    true,
    true
  ) ON CONFLICT (code) DO NOTHING;
END $$;
