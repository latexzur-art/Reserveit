-- =====================================================
-- Quick Verification Script for Course Selection Feature
-- =====================================================
-- Run this in Supabase Dashboard > SQL Editor to verify
-- the migration was applied successfully
-- =====================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Test 1: Check booking_course_code column exists'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bookings'
  AND column_name = 'booking_course_code';

-- Expected: 1 row showing booking_course_code | character varying | YES


\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Test 2: Check course_facility_affinity table exists'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'course_facility_affinity';

-- Expected: 1 row showing course_facility_affinity | BASE TABLE


\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Test 3: Check new departments were added'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  code,
  name,
  is_active
FROM public.departments
WHERE code IN ('BSIS', 'BSA', 'BSAIS', 'BSCM', 'BACOMM')
ORDER BY code;

-- Expected: 5 rows
-- BACOMM | Bachelor of Arts in Communication
-- BSA    | Bachelor of Science in Accountancy
-- BSAIS  | Bachelor of Science in Accounting Information Systems
-- BSCM   | Bachelor of Science in Culinary Management
-- BSIS   | Bachelor of Science in Information Systems


\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Test 4: Check course-facility affinity mappings'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  course_code,
  facility_tag,
  affinity_points,
  LEFT(notes, 50) as notes_preview
FROM public.course_facility_affinity
ORDER BY facility_tag, course_code;

-- Expected: 14 rows showing all mappings
-- Sample expected rows:
-- BACOMM | av_studio      | 15
-- BMMA   | av_studio      | 15
-- BMMA   | computer_use   | 15
-- BSCpE  | computer_use   | 15
-- BSCS   | computer_use   | 15
-- BSIS   | computer_use   | 15
-- BSIT   | computer_use   | 15
-- BSCM   | hospitality_lab| 15
-- BSHM   | hospitality_lab| 15
-- BSTM   | hospitality_lab| 15


\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Test 5: Count affinity mappings by facility type'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  facility_tag,
  COUNT(*) as course_count,
  ARRAY_AGG(course_code ORDER BY course_code) as courses
FROM public.course_facility_affinity
GROUP BY facility_tag
ORDER BY facility_tag;

-- Expected:
-- av_studio       | 2 | {BACOMM, BMMA}
-- computer_use    | 5 | {BMMA, BSCpE, BSCS, BSIS, BSIT}
-- hospitality_lab | 3 | {BSCM, BSHM, BSTM}


\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Test 6: Verify computer labs have correct tags'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  f.room_number,
  f.name,
  ARRAY_AGG(fpt.tag) as tags
FROM public.facilities f
LEFT JOIN public.facility_purpose_tags fpt ON f.id = fpt.facility_id
WHERE f.room_number IN ('103', '303', '304', '308', '309')
GROUP BY f.room_number, f.name
ORDER BY f.room_number;

-- Expected: Each computer lab should have 'computer_use' tag


\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Test 7: Verify hospitality labs have correct tags'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  f.room_number,
  f.name,
  ARRAY_AGG(fpt.tag) as tags,
  d.code as primary_dept
FROM public.facilities f
LEFT JOIN public.facility_purpose_tags fpt ON f.id = fpt.facility_id
LEFT JOIN public.departments d ON f.primary_department_id = d.id
WHERE f.room_number IN ('306', '307', '311')
GROUP BY f.room_number, f.name, d.code
ORDER BY f.room_number;

-- Expected: Each hospitality lab should have 'hospitality_lab' tag
-- 306, 307 → BSHM primary dept
-- 311 → BSTM primary dept


\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Test 8: Check RLS policies on course_facility_affinity'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'course_facility_affinity'
ORDER BY policyname;

-- Expected: 2 policies
-- manage_course_affinity | authenticated | ALL
-- read_course_affinity   | authenticated | SELECT


\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Test 9: Simulate scoring for BSIT + Computer Lab'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

WITH test_scenario AS (
  SELECT
    'BSIT' as course_code,
    'computer_use' as facility_tag
)
SELECT
  ts.course_code,
  ts.facility_tag,
  cfa.affinity_points,
  80 as base_score,
  (80 + cfa.affinity_points) as expected_final_score,
  CASE
    WHEN (80 + cfa.affinity_points) >= 85 THEN 'AUTO-APPROVED ✓'
    ELSE 'NEEDS REVIEW'
  END as expected_decision
FROM test_scenario ts
JOIN public.course_facility_affinity cfa
  ON cfa.course_code = ts.course_code
  AND cfa.facility_tag = ts.facility_tag;

-- Expected:
-- BSIT | computer_use | 15 | 80 | 95 | AUTO-APPROVED ✓


\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'Test 10: Check indexes were created'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname = 'idx_bookings_course_code'
    OR indexname = 'idx_course_affinity_code'
    OR indexname = 'idx_course_affinity_tag'
  )
ORDER BY indexname;

-- Expected: 3 indexes
-- idx_bookings_course_code
-- idx_course_affinity_code
-- idx_course_affinity_tag


\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✓ VERIFICATION COMPLETE'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'If all tests returned expected results, the migration'
\echo 'was applied successfully!'
\echo ''
\echo 'If any test failed, run the migration:'
\echo 'supabase/migrations/20260302_add_course_selection.sql'
\echo ''
