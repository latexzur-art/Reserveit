-- =====================================================
-- Migration: Cleanup Roles & Seed User Manager
-- =====================================================
-- Description:
--   1. Delete removed roles (school_admin, dean, dept_head, cashier)
--   2. Update program_head & academic_head with display properties
--   3. Seed bootstrap User Manager account
--   4. Update get_user_primary_role() priority array
-- Date: 2026-02-08
-- =====================================================

-- ============================================================
-- STEP 1: Delete removed roles and their user_roles assignments
-- ============================================================

DELETE FROM public.user_roles WHERE role_id IN (
  SELECT id FROM public.roles WHERE name IN ('school_admin', 'dean', 'dept_head', 'cashier')
);

DELETE FROM public.roles WHERE name IN ('school_admin', 'dean', 'dept_head', 'cashier');

-- ============================================================
-- STEP 2: Update program_head & academic_head with display props
-- ============================================================

UPDATE public.roles SET
  display_name = 'Program Head',
  badge_color = 'yellow',
  is_internal_only = TRUE
WHERE name = 'program_head';

UPDATE public.roles SET
  display_name = 'Academic Head',
  badge_color = 'purple',
  is_internal_only = TRUE
WHERE name = 'academic_head';

-- ============================================================
-- STEP 3: Seed bootstrap User Manager account
-- ============================================================
-- This pre-registers the IT admin so the auth trigger can link
-- their MS365 account on first sign-in.

INSERT INTO public.users (id, email, full_name, user_type, account_status, employee_id, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'it-admin@reserveitlucena.onmicrosoft.com',
  'IT Administrator',
  'internal',
  'pending',
  'USR-0001',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Assign user_manager role to the bootstrap admin
INSERT INTO public.user_roles (user_id, role_id, is_active, assigned_at)
SELECT u.id, r.id, TRUE, NOW()
FROM public.users u, public.roles r
WHERE u.email = 'it-admin@reserveitlucena.onmicrosoft.com'
  AND r.name = 'user_manager'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- ============================================================
-- STEP 4: Update get_user_primary_role() with new role priority
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_primary_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
  role_priority TEXT[] := ARRAY[
    'user_manager',
    'building_admin',
    'academic_head',
    'program_head',
    'faculty',
    'external_client'
  ];
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY role_priority
  LOOP
    IF user_has_role(role_name) THEN
      RETURN role_name;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_primary_role IS 'Returns the highest-priority role for the current user';
