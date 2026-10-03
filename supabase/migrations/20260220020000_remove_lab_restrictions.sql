/**
 * Remove blanket restrictions from labs to enable smart department-based approval
 * - Computer Labs (103, 303, 304, 308, 309): BSIT/BSCS students get +15 bonus, others neutral
 * - Science Labs (301, 302): Open to all departments (no restrictions)
 * - Main Auditorium: Keep restricted, but purpose-aware (block commercial/community, allow academic)
 */

-- Remove always_requires_approval from all computer labs
UPDATE facilities
SET
  always_requires_approval = false,
  restricted_notes = NULL
WHERE room_number IN ('103', '303', '304', '308', '309')
  AND facility_type_id = (SELECT id FROM public.facility_types WHERE name = 'computer_lab' LIMIT 1);

-- Remove always_requires_approval from all science labs
UPDATE facilities
SET
  always_requires_approval = false,
  restricted_notes = NULL
WHERE room_number IN ('301', '302')
  AND facility_type_id = (SELECT id FROM public.facility_types WHERE name = 'science_lab' LIMIT 1);

-- Main Auditorium keeps restriction (will be checked by purpose in hardConstraintChecker)
-- No changes needed - already has always_requires_approval = true

-- Verify final state
SELECT
  f.name,
  f.room_number,
  ft.name AS facility_type,
  f.facility_tier,
  f.always_requires_approval,
  f.restricted_notes
FROM facilities f
JOIN public.facility_types ft ON f.facility_type_id = ft.id
WHERE f.facility_tier IN ('specialized', 'premium')
ORDER BY f.room_number;
