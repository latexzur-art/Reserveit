-- =====================================================
-- Migration: Tag Remaining Specialized Facilities
-- =====================================================
-- Description: 
--   1. Tag Hospitality labs (306, 307, 311) as 'hospitality_lab'
--   2. Tag Multipurpose Halls (MPH1, MPH2, MPH3) as 'multipurpose'
--   3. Tag Conference Rooms as 'conference'
--   4. Set primary_department_id for Hospitality labs (BSHM)
-- Date: 2026-02-23
-- =====================================================

-- 1. Tag Hospitality labs
INSERT INTO public.facility_purpose_tags (facility_id, tag)
SELECT id, 'hospitality_lab'
FROM public.facilities
WHERE room_number IN ('306', '307', '311')
ON CONFLICT (facility_id, tag) DO NOTHING;

-- 2. Tag Multipurpose Halls
INSERT INTO public.facility_purpose_tags (facility_id, tag)
SELECT id, 'multipurpose'
FROM public.facilities
WHERE name ILIKE '%MPH%' OR name ILIKE '%Multipurpose Hall%'
ON CONFLICT (facility_id, tag) DO NOTHING;

-- 3. Tag Conference Rooms
INSERT INTO public.facility_purpose_tags (facility_id, tag)
SELECT id, 'conference'
FROM public.facilities
WHERE name ILIKE '%Conference Room%'
ON CONFLICT (facility_id, tag) DO NOTHING;

-- 4. Set primary department for Hospitality labs
-- BSHM for 306, 307
UPDATE public.facilities
SET primary_department_id = (SELECT id FROM public.departments WHERE code = 'BSHM')
WHERE room_number IN ('306', '307')
  AND primary_department_id IS NULL;

-- BSTM for 311
UPDATE public.facilities
SET primary_department_id = (SELECT id FROM public.departments WHERE code = 'BSTM')
WHERE room_number = '311'
  AND (primary_department_id IS NULL OR primary_department_id = (SELECT id FROM public.departments WHERE code = 'BSHM'));
