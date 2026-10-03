-- =====================================================
-- Migration: Computer Lab Whitelist Expansion
-- =====================================================
-- Description:
--   Adds department_facility_exceptions entries for all
--   departments missing from the computer_use whitelist.
--   Previously only BSTM, BSHM, BSBA had entries, meaning
--   IT/CS/CpE programs (the primary lab users) were always
--   flagged for Academic Head review.
--
--   Also patches the 3 existing entries with missing activities.
-- Date: 2026-05-16
-- =====================================================

-- =====================================================
-- PART 1: Add missing entries for IT/tech programs
-- =====================================================

-- BSIT — uses labs for everything: programming, networking, multimedia
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'programming_class',
    'networking_lab',
    'graphic_design',
    'multimedia_production',
    'video_editing',
    'photography_editing',
    'internet_research',
    'data_encoding',
    'presentation',
    'documentation',
    'spreadsheet_work'
  ],
  TRUE,
  'BSIT programs use computer labs for their core curriculum — programming, networking, and digital media'
FROM public.departments d
WHERE d.code = 'BSIT'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- BSCS — same scope as BSIT
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'programming_class',
    'networking_lab',
    'graphic_design',
    'multimedia_production',
    'video_editing',
    'photography_editing',
    'internet_research',
    'data_encoding',
    'presentation',
    'documentation',
    'spreadsheet_work'
  ],
  TRUE,
  'BSCS programs use computer labs for their core curriculum — programming, networking, and digital media'
FROM public.departments d
WHERE d.code = 'BSCS'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- BSCpE — hardware/software focus; includes programming and networking
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'programming_class',
    'networking_lab',
    'graphic_design',
    'internet_research',
    'data_encoding',
    'presentation',
    'documentation',
    'spreadsheet_work'
  ],
  TRUE,
  'BSCpE uses computer labs for programming, networking, and hardware-software integration exercises'
FROM public.departments d
WHERE d.code = 'BSCpE'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- BSIS — information systems: programming, business simulations, data work
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'programming_class',
    'networking_lab',
    'graphic_design',
    'business_simulation',
    'internet_research',
    'data_encoding',
    'presentation',
    'documentation',
    'spreadsheet_work'
  ],
  TRUE,
  'BSIS uses computer labs for programming, systems analysis, business simulations, and data work'
FROM public.departments d
WHERE d.code = 'BSIS'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- ACT — associate-level IT; core programming and networking
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'programming_class',
    'networking_lab',
    'internet_research',
    'data_encoding',
    'presentation',
    'documentation',
    'spreadsheet_work'
  ],
  TRUE,
  'ACT uses computer labs for core IT skills: programming, networking, and office productivity'
FROM public.departments d
WHERE d.code = 'ACT'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- =====================================================
-- PART 2: Add missing entries for arts/media programs
-- =====================================================

-- BMMA — multimedia arts: graphic design, video, photo editing
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'graphic_design',
    'multimedia_production',
    'video_editing',
    'photography_editing',
    'internet_research',
    'data_encoding',
    'presentation',
    'documentation'
  ],
  TRUE,
  'BMMA uses computer labs for digital design, video/photo editing, and multimedia production'
FROM public.departments d
WHERE d.code = 'BMMA'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- BACOMM — communication: media production, research, presentations
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'graphic_design',
    'multimedia_production',
    'video_editing',
    'photography_editing',
    'internet_research',
    'presentation',
    'documentation'
  ],
  TRUE,
  'BACOMM uses computer labs for media production, digital content creation, and research'
FROM public.departments d
WHERE d.code = 'BACOMM'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- =====================================================
-- PART 3: Add missing entries for accounting programs
-- =====================================================

-- BSA — accountancy: spreadsheets, business simulations, research
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'spreadsheet_work',
    'business_simulation',
    'internet_research',
    'data_encoding',
    'presentation',
    'documentation'
  ],
  TRUE,
  'BSA uses computer labs for accounting software, spreadsheet exercises, and business simulations'
FROM public.departments d
WHERE d.code = 'BSA'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- BSAIS — accounting information systems: same as BSA, naturally technology-oriented
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'spreadsheet_work',
    'business_simulation',
    'internet_research',
    'data_encoding',
    'presentation',
    'documentation'
  ],
  TRUE,
  'BSAIS uses computer labs for accounting information systems, data work, and business simulations'
FROM public.departments d
WHERE d.code = 'BSAIS'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- =====================================================
-- PART 4: Add missing entries for culinary/hospitality
-- =====================================================

-- BSCM — culinary management: food costing, inventory, research
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'food_costing',
    'inventory_management',
    'spreadsheet_work',
    'internet_research',
    'data_encoding',
    'presentation',
    'documentation'
  ],
  TRUE,
  'BSCM uses computer labs for food costing software, inventory management, and culinary research'
FROM public.departments d
WHERE d.code = 'BSCM'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- =====================================================
-- PART 5: Add general-access entries (SHS, GEN)
-- =====================================================

-- SHS — senior high school: basic computing and introductory programming
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'programming_class',
    'internet_research',
    'data_encoding',
    'presentation',
    'documentation'
  ],
  TRUE,
  'SHS uses computer labs for basic computing, introductory programming, and academic work'
FROM public.departments d
WHERE d.code = 'SHS'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- GEN — general administration: office productivity only
INSERT INTO public.department_facility_exceptions
  (department_id, facility_type, allowed_purpose_categories, auto_approve_eligible, notes)
SELECT d.id,
  'computer_use',
  ARRAY[
    'internet_research',
    'data_encoding',
    'presentation',
    'documentation'
  ],
  TRUE,
  'GEN uses computer labs for general administrative tasks and documentation'
FROM public.departments d
WHERE d.code = 'GEN'
ON CONFLICT (department_id, facility_type) DO NOTHING;

-- =====================================================
-- PART 6: Patch existing entries with missing activities
-- =====================================================

-- BSTM: add spreadsheet_work (useful for tourism budgeting exercises)
UPDATE public.department_facility_exceptions
SET allowed_purpose_categories = array_append(allowed_purpose_categories, 'spreadsheet_work')
WHERE facility_type = 'computer_use'
  AND department_id = (SELECT id FROM public.departments WHERE code = 'BSTM')
  AND NOT ('spreadsheet_work' = ANY(allowed_purpose_categories));

-- BSHM: add data_encoding and spreadsheet_work
UPDATE public.department_facility_exceptions
SET allowed_purpose_categories = array_append(allowed_purpose_categories, 'data_encoding')
WHERE facility_type = 'computer_use'
  AND department_id = (SELECT id FROM public.departments WHERE code = 'BSHM')
  AND NOT ('data_encoding' = ANY(allowed_purpose_categories));

UPDATE public.department_facility_exceptions
SET allowed_purpose_categories = array_append(allowed_purpose_categories, 'spreadsheet_work')
WHERE facility_type = 'computer_use'
  AND department_id = (SELECT id FROM public.departments WHERE code = 'BSHM')
  AND NOT ('spreadsheet_work' = ANY(allowed_purpose_categories));

-- BSBA: add data_encoding and inventory_management
UPDATE public.department_facility_exceptions
SET allowed_purpose_categories = array_append(allowed_purpose_categories, 'data_encoding')
WHERE facility_type = 'computer_use'
  AND department_id = (SELECT id FROM public.departments WHERE code = 'BSBA')
  AND NOT ('data_encoding' = ANY(allowed_purpose_categories));

UPDATE public.department_facility_exceptions
SET allowed_purpose_categories = array_append(allowed_purpose_categories, 'inventory_management')
WHERE facility_type = 'computer_use'
  AND department_id = (SELECT id FROM public.departments WHERE code = 'BSBA')
  AND NOT ('inventory_management' = ANY(allowed_purpose_categories));
