-- =====================================================
-- Seed: Facility-Purpose Mismatch System Initial Data
-- =====================================================
-- Description:
--   1. Insert missing departments (BMMA, BSCpE)
--   2. Tag computer labs as 'computer_use'
--   3. Tag Room 401 & 402 (AV studios) as 'av_studio'
--   4. Set primary_department_id on Room 401 & 402 (BMMA)
--   5. Insert cross-department exception whitelist entries
--      for BSTM, BSHM, BSBA → computer_use
-- Date: 2026-02-22
-- =====================================================

-- =====================================================
-- STEP 1: Insert missing departments
-- =====================================================

INSERT INTO public.departments (id, code, name, description, is_active)
VALUES
  (gen_random_uuid(), 'BMMA', 'Bachelor of Multimedia Arts',
   'Multimedia arts, photography, broadcasting, and digital design program', TRUE),
  (gen_random_uuid(), 'BSCpE', 'Bachelor of Science in Computer Engineering',
   'Computer engineering focusing on hardware-software integration', TRUE)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- STEP 2: Tag all computer laboratories as 'computer_use'
-- =====================================================

INSERT INTO public.facility_purpose_tags (facility_id, tag)
SELECT id, 'computer_use'
FROM public.facilities
WHERE name ILIKE '%computer lab%'
   OR name ILIKE '%computer laboratory%'
ON CONFLICT (facility_id, tag) DO NOTHING;

-- =====================================================
-- STEP 3: Tag Room 401 & 402 as 'av_studio'
-- =====================================================
-- Room 401 = Photography Studio (Engr. Lusterio interview)
-- Room 402 = Broadcasting Studio

INSERT INTO public.facility_purpose_tags (facility_id, tag)
SELECT id, 'av_studio'
FROM public.facilities
WHERE room_number IN ('401', '402')
ON CONFLICT (facility_id, tag) DO NOTHING;

-- =====================================================
-- STEP 4: Set primary_department_id on Room 401 & 402
-- =====================================================
-- BMMA is the primary department for both AV studios.
-- Any BMMA faculty booking these rooms bypasses mismatch checks.

UPDATE public.facilities
SET primary_department_id = (SELECT id FROM public.departments WHERE code = 'BMMA')
WHERE room_number IN ('401', '402')
  AND primary_department_id IS NULL;

-- =====================================================
-- STEP 5: Exception whitelist — cross-department uses
-- =====================================================

-- BSTM (Tourism Management) → computer_use
-- Tourism instructors frequently use computer labs for internet research,
-- booking simulations, and e-tourism tools.
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'internet_research',
    'data_encoding',
    'presentation',
    'documentation',
    'online_booking_simulation',
    'e_tourism_tools'
  ],
  TRUE,
  'BSTM uses computer labs for online research, booking simulations, and documentation'
FROM public.departments d
WHERE d.code = 'BSTM'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- BSHM (Hospitality Management) → computer_use
-- Hospitality instructors use computer labs for food costing software,
-- online research, and inventory management tools.
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'internet_research',
    'documentation',
    'presentation',
    'food_costing',
    'inventory_management'
  ],
  TRUE,
  'BSHM uses computers for food costing software, online research, and inventory tools'
FROM public.departments d
WHERE d.code = 'BSHM'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- BSBA (Business Administration) → computer_use
-- Business instructors use computer labs for financial tools,
-- business simulations, and spreadsheet-heavy coursework.
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'internet_research',
    'documentation',
    'presentation',
    'spreadsheet_work',
    'business_simulation'
  ],
  TRUE,
  'BSBA uses computers for business simulations, financial tools, and research'
FROM public.departments d
WHERE d.code = 'BSBA'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- NOTE: Rooms 401 & 402 (av_studio) have NO whitelist entries.
-- Any non-BMMA booking of these rooms always routes to Academic Head review.
-- The Academic Head can approve case-by-case or suggest an alternative.
