-- =====================================================
-- Seed Actual Facilities (50 Real Facilities)
-- =====================================================
-- Description: Replace sample facilities with actual 50 facilities from institution
-- Date: 2026-02-20
-- Source: mdfiles/facilitieslist.md
-- =====================================================

-- Clear dependent data first (to avoid foreign key constraint violations)
DELETE FROM public.class_schedules;
DELETE FROM public.booking_facilities;
DELETE FROM public.bookings;

-- Clear existing sample facilities
DELETE FROM public.facilities;

-- Insert all 50 real facilities
DO $$
DECLARE
  floor_1_id UUID;  -- 1st Floor
  floor_2_id UUID;  -- Mezzanine
  floor_3_id UUID;  -- 2nd Floor
  floor_4_id UUID;  -- 3rd Floor
  floor_5_id UUID;  -- 4th Floor
  floor_6_id UUID;  -- 5th Floor

  type_classroom UUID;
  type_computer_lab UUID;
  type_science_lab UUID;
  type_multipurpose UUID;
  type_conference UUID;
  type_studio UUID;
  type_library UUID;
BEGIN
  -- Get floor IDs
  SELECT id INTO floor_1_id FROM public.floors WHERE floor_number = 1 LIMIT 1;
  SELECT id INTO floor_2_id FROM public.floors WHERE floor_number = 2 LIMIT 1;
  SELECT id INTO floor_3_id FROM public.floors WHERE floor_number = 3 LIMIT 1;
  SELECT id INTO floor_4_id FROM public.floors WHERE floor_number = 4 LIMIT 1;
  SELECT id INTO floor_5_id FROM public.floors WHERE floor_number = 5 LIMIT 1;
  SELECT id INTO floor_6_id FROM public.floors WHERE floor_number = 6 LIMIT 1;

  -- Get facility type IDs
  SELECT id INTO type_classroom FROM public.facility_types WHERE name = 'classroom' LIMIT 1;
  SELECT id INTO type_computer_lab FROM public.facility_types WHERE name = 'computer_lab' LIMIT 1;
  SELECT id INTO type_science_lab FROM public.facility_types WHERE name = 'science_lab' LIMIT 1;
  SELECT id INTO type_multipurpose FROM public.facility_types WHERE name = 'multipurpose_hall' LIMIT 1;
  SELECT id INTO type_conference FROM public.facility_types WHERE name = 'conference_room' LIMIT 1;
  SELECT id INTO type_studio FROM public.facility_types WHERE name = 'studio' LIMIT 1;
  SELECT id INTO type_library FROM public.facility_types WHERE name = 'library_room' LIMIT 1;

  -- Verify all references exist
  IF floor_1_id IS NULL OR type_classroom IS NULL THEN
    RAISE EXCEPTION 'Missing required floor or facility type references';
  END IF;

  -- =====================================================
  -- GROUND FLOOR (2 facilities)
  -- =====================================================
  INSERT INTO public.facilities (
    code, name, description, floor_id, facility_type_id,
    capacity, area_sqm, room_number, requires_approval,
    facility_tier, always_requires_approval, is_bookable
  ) VALUES
    (
      'GF-CL-103',
      'Room 103 - Computer Laboratory',
      'Computer laboratory for general use',
      floor_1_id,
      type_computer_lab,
      53,
      NULL,
      '103',
      true,
      'specialized',
      true,
      true
    ),
    (
      'GF-MPH-001',
      'MPH1',
      'Multipurpose Hall 1 - Large venue for events',
      floor_1_id,
      type_multipurpose,
      80,
      NULL,
      'MPH1',
      true,
      'premium',
      true,
      true
    );

  -- =====================================================
  -- 2ND FLOOR (17 facilities)
  -- =====================================================
  INSERT INTO public.facilities (
    code, name, description, floor_id, facility_type_id,
    capacity, area_sqm, room_number, requires_approval,
    facility_tier, always_requires_approval, is_bookable
  ) VALUES
    -- Standard classrooms 201-208 (40 capacity)
    ('2F-RM-201', 'Room 201', 'Standard classroom', floor_3_id, type_classroom, 40, NULL, '201', false, 'standard', false, true),
    ('2F-RM-202', 'Room 202', 'Standard classroom', floor_3_id, type_classroom, 40, NULL, '202', false, 'standard', false, true),
    ('2F-RM-203', 'Room 203', 'Standard classroom', floor_3_id, type_classroom, 40, NULL, '203', false, 'standard', false, true),
    ('2F-RM-204', 'Room 204', 'Standard classroom', floor_3_id, type_classroom, 40, NULL, '204', false, 'standard', false, true),
    ('2F-RM-205', 'Room 205', 'Standard classroom', floor_3_id, type_classroom, 40, NULL, '205', false, 'standard', false, true),
    ('2F-RM-206', 'Room 206', 'Standard classroom', floor_3_id, type_classroom, 40, NULL, '206', false, 'standard', false, true),
    ('2F-RM-207', 'Room 207', 'Standard classroom', floor_3_id, type_classroom, 40, NULL, '207', false, 'standard', false, true),
    ('2F-RM-208', 'Room 208', 'Standard classroom', floor_3_id, type_classroom, 40, NULL, '208', false, 'standard', false, true),
    -- Larger classrooms 209-212 (48 capacity)
    ('2F-RM-209', 'Room 209', 'Large classroom', floor_3_id, type_classroom, 48, NULL, '209', false, 'standard', false, true),
    ('2F-RM-210', 'Room 210', 'Large classroom', floor_3_id, type_classroom, 48, NULL, '210', false, 'standard', false, true),
    ('2F-RM-211', 'Room 211', 'Large classroom', floor_3_id, type_classroom, 48, NULL, '211', false, 'standard', false, true),
    ('2F-RM-212', 'Room 212', 'Large classroom', floor_3_id, type_classroom, 48, NULL, '212', false, 'standard', false, true),
    -- Remaining classrooms
    ('2F-RM-213', 'Room 213', 'Standard classroom', floor_3_id, type_classroom, 40, NULL, '213', false, 'standard', false, true),
    ('2F-RM-214', 'Room 214', 'Large classroom', floor_3_id, type_classroom, 50, NULL, '214', false, 'standard', false, true),
    -- Conference Room and Multipurpose Hall
    ('2F-CR-001', 'Conference Room', 'Conference room for meetings', floor_3_id, type_conference, 20, 12.9, 'CR', true, 'standard', true, true),
    ('2F-MPH-002', 'Multipurpose Hall 2', 'Multipurpose Hall 2 - Medium venue', floor_2_id, type_multipurpose, 100, 105.48, 'MPH2', true, 'premium', true, true);

  -- =====================================================
  -- 3RD FLOOR (11 facilities)
  -- =====================================================
  INSERT INTO public.facilities (
    code, name, description, floor_id, facility_type_id,
    capacity, area_sqm, room_number, requires_approval,
    facility_tier, always_requires_approval, is_bookable, restricted_notes
  ) VALUES
    -- Science Labs
    (
      '3F-SL-301',
      'Room 301 - Physics Laboratory',
      'Physics laboratory with specialized equipment',
      floor_4_id,
      type_science_lab,
      40,
      NULL,
      '301',
      true,
      'specialized',
      true,
      true,
      'Requires lab safety orientation and faculty supervision. Must coordinate with lab coordinator.'
    ),
    (
      '3F-SL-302',
      'Room 302 - Chemistry Laboratory',
      'Chemistry laboratory with specialized equipment',
      floor_4_id,
      type_science_lab,
      40,
      NULL,
      '302',
      true,
      'specialized',
      true,
      true,
      'Requires lab safety orientation and faculty supervision. Must coordinate with lab coordinator.'
    ),
    -- Computer Labs
    ('3F-CL-303', 'Room 303 - Computer Laboratory', 'Computer laboratory', floor_4_id, type_computer_lab, 41, NULL, '303', true, 'specialized', true, true, NULL),
    ('3F-CL-304', 'Room 304 - Computer Laboratory', 'Computer laboratory', floor_4_id, type_computer_lab, 50, NULL, '304', true, 'specialized', true, true, NULL),
    ('3F-CL-308', 'Room 308 - Computer Laboratory', 'Computer laboratory', floor_4_id, type_computer_lab, 47, NULL, '308', true, 'specialized', true, true, NULL),
    ('3F-CL-309', 'Room 309 - Computer Laboratory', 'Computer laboratory', floor_4_id, type_computer_lab, 45, NULL, '309', true, 'specialized', true, true, NULL),
    -- Regular classrooms and specialized hospitality rooms
    ('3F-RM-305', 'Room 305', 'Standard classroom', floor_4_id, type_classroom, 50, NULL, '305', false, 'standard', false, true, NULL),
    ('3F-RM-306', 'Room 306 - Hotel Suite/Laundry', 'Hospitality management training room - Hotel suite and laundry facilities', floor_4_id, type_classroom, 40, NULL, '306', false, 'specialized', false, true, NULL),
    ('3F-RM-307', 'Room 307 - Bar and Dining', 'Hospitality management training room - Bar and dining area', floor_4_id, type_classroom, 30, NULL, '307', false, 'specialized', false, true, NULL),
    ('3F-RM-310', 'Room 310', 'Standard classroom', floor_4_id, type_classroom, 40, NULL, '310', false, 'standard', false, true, NULL),
    ('3F-RM-311', 'Room 311 - Hotel Reception/Travel Counter', 'Hospitality management training room - Hotel reception and travel counter', floor_4_id, type_classroom, 40, NULL, '311', false, 'specialized', false, true, NULL);

  -- =====================================================
  -- MEZZANINE / 4TH FLOOR (8 facilities)
  -- =====================================================
  INSERT INTO public.facilities (
    code, name, description, floor_id, facility_type_id,
    capacity, area_sqm, room_number, requires_approval,
    facility_tier, always_requires_approval, is_bookable, restricted_notes
  ) VALUES
    -- Specialized Studios
    (
      '4F-ST-401',
      'Room 401 - Photography Studio',
      'Photography studio with professional equipment',
      floor_5_id,
      type_studio,
      30,
      53.03,
      '401',
      true,
      'specialized',
      true,
      true,
      'Contains specialized photography equipment. Requires instructor or studio coordinator approval.'
    ),
    (
      '4F-ST-402',
      'Room 402 - Broadcasting Studio',
      'Broadcasting studio with media production equipment',
      floor_5_id,
      type_studio,
      30,
      63.72,
      '402',
      true,
      'specialized',
      true,
      true,
      'Contains specialized broadcasting equipment. Requires instructor or studio coordinator approval.'
    ),
    -- Library
    (
      '4F-LIB-001',
      'Library',
      'Main library facility',
      floor_5_id,
      type_library,
      100,
      283.83,
      'Library',
      false,
      'standard',
      false,
      true,
      NULL
    ),
    -- Regular classrooms
    ('4F-RM-403', 'Room 403', 'Standard classroom', floor_5_id, type_classroom, 40, NULL, '403', false, 'standard', false, true, NULL),
    ('4F-RM-404', 'Room 404', 'Standard classroom', floor_5_id, type_classroom, 40, NULL, '404', false, 'standard', false, true, NULL),
    ('4F-RM-405', 'Room 405', 'Standard classroom', floor_5_id, type_classroom, 40, NULL, '405', false, 'standard', false, true, NULL),
    ('4F-RM-406', 'Room 406', 'Standard classroom', floor_5_id, type_classroom, 35, 57.59, '406', false, 'standard', false, true, NULL),
    ('4F-RM-407', 'Room 407', 'Standard classroom', floor_5_id, type_classroom, 35, 59.78, '407', false, 'standard', false, true, NULL);

  -- =====================================================
  -- 5TH FLOOR (12 facilities)
  -- =====================================================
  INSERT INTO public.facilities (
    code, name, description, floor_id, facility_type_id,
    capacity, area_sqm, room_number, requires_approval,
    facility_tier, always_requires_approval, is_bookable
  ) VALUES
    -- Standard classrooms 501-506 (40 capacity)
    ('5F-RM-501', 'Room 501', 'Standard classroom', floor_6_id, type_classroom, 40, NULL, '501', false, 'standard', false, true),
    ('5F-RM-502', 'Room 502', 'Standard classroom', floor_6_id, type_classroom, 40, NULL, '502', false, 'standard', false, true),
    ('5F-RM-503', 'Room 503', 'Standard classroom', floor_6_id, type_classroom, 40, NULL, '503', false, 'standard', false, true),
    ('5F-RM-504', 'Room 504', 'Standard classroom', floor_6_id, type_classroom, 40, NULL, '504', false, 'standard', false, true),
    ('5F-RM-505', 'Room 505', 'Standard classroom', floor_6_id, type_classroom, 40, NULL, '505', false, 'standard', false, true),
    ('5F-RM-506', 'Room 506', 'Standard classroom', floor_6_id, type_classroom, 40, NULL, '506', false, 'standard', false, true),
    -- Larger classrooms 507-510 (50 capacity)
    ('5F-RM-507', 'Room 507', 'Large classroom', floor_6_id, type_classroom, 50, NULL, '507', false, 'standard', false, true),
    ('5F-RM-508', 'Room 508', 'Large classroom', floor_6_id, type_classroom, 50, NULL, '508', false, 'standard', false, true),
    ('5F-RM-509', 'Room 509', 'Large classroom', floor_6_id, type_classroom, 50, NULL, '509', false, 'standard', false, true),
    ('5F-RM-510', 'Room 510', 'Large classroom', floor_6_id, type_classroom, 50, NULL, '510', false, 'standard', false, true),
    -- Smaller classroom 511 (30 capacity)
    ('5F-RM-511', 'Room 511', 'Classroom', floor_6_id, type_classroom, 30, NULL, '511', false, 'standard', false, true),
    -- Multipurpose Hall 3
    ('5F-MPH-003', 'Multipurpose Hall 3', 'Multipurpose Hall 3 - Large venue', floor_6_id, type_multipurpose, 100, NULL, 'MPH3', true, 'premium', true, true);

END $$;

-- =====================================================
-- Update Floor Descriptions
-- =====================================================
UPDATE public.floors
SET
  name = '1st Floor',
  description = 'Computer laboratory and multipurpose hall'
WHERE floor_number = 1;

UPDATE public.floors
SET
  name = 'Mezzanine',
  description = 'Multipurpose Hall 2 and administrative offices'
WHERE floor_number = 2;

UPDATE public.floors
SET
  name = '2nd Floor',
  description = 'Standard classrooms, conference room, and lecture halls'
WHERE floor_number = 3;

UPDATE public.floors
SET
  name = '3rd Floor',
  description = 'Science laboratories, computer laboratories, and hospitality training rooms'
WHERE floor_number = 4;

UPDATE public.floors
SET
  name = '4th Floor',
  description = 'Photography and broadcasting studios, library, and specialized rooms'
WHERE floor_number = 5;

UPDATE public.floors
SET
  name = '5th Floor',
  description = 'Classrooms and multipurpose hall'
WHERE floor_number = 6;

-- =====================================================
-- Verification Queries (commented out - run manually to verify)
-- =====================================================

-- Check total facility count (should be 50)
-- SELECT COUNT(*) as total_facilities FROM public.facilities WHERE is_active = true;

-- Check floor distribution
-- SELECT f.name as floor, COUNT(fac.id) as facility_count
-- FROM public.floors f
-- LEFT JOIN public.facilities fac ON fac.floor_id = f.id
-- WHERE fac.is_active = true
-- GROUP BY f.id, f.name
-- ORDER BY f.floor_number;

-- Check facility types distribution
-- SELECT ft.name, COUNT(fac.id) as count
-- FROM public.facility_types ft
-- LEFT JOIN public.facilities fac ON fac.facility_type_id = ft.id
-- WHERE fac.is_active = true
-- GROUP BY ft.name
-- ORDER BY count DESC;

-- Check specialized facilities
-- SELECT code, name, capacity, area_sqm, facility_tier, always_requires_approval
-- FROM public.facilities
-- WHERE facility_tier IN ('specialized', 'premium')
-- ORDER BY code;

COMMENT ON TABLE public.facilities IS 'Main facility records - 50 actual facilities across 5 floors (Ground, 2nd, 3rd, Mezzanine, 5th)';
