-- =====================================================
-- Create pamo_officer role + bootstrap account
-- =====================================================
-- Description: PAMO (Purchasing and Asset Management Officer) owns the
--   non-tech equipment inventory. Adds the role, wires it into the
--   primary-role priority, and pre-registers a bootstrap account so the
--   MS365 auth trigger links it on first sign-in.
-- Date: 2026-08-06
-- =====================================================

-- STEP 1: Role
INSERT INTO public.roles (name, description, permissions, display_name, badge_color, is_internal_only)
VALUES (
  'pamo_officer',
  'PAMO - Purchasing and Asset Management Officer: owns non-tech equipment inventory',
  '{"equipment":["create","read","update","delete"],"equipment_types":["read"],"reports":["read","update"]}',
  'PAMO',
  'teal',
  TRUE
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  display_name = EXCLUDED.display_name,
  badge_color = EXCLUDED.badge_color,
  is_internal_only = EXCLUDED.is_internal_only,
  updated_at = NOW();

-- STEP 2: Primary-role priority (insert pamo_officer after building_admin).
-- Rewrite adds the SET search_path the prior version was missing.
CREATE OR REPLACE FUNCTION get_user_primary_role()
RETURNS TEXT AS $$
DECLARE
  role_priority TEXT[] := ARRAY[
    'user_manager',
    'building_admin',
    'pamo_officer',
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION get_user_primary_role IS 'Returns the highest-priority role for the current user';

-- STEP 3: Bootstrap PAMO account (mirrors the it-admin bootstrap in
-- 20260208010100). Pre-registered so the auth trigger links MS365 on login.
INSERT INTO public.users (id, email, full_name, user_type, account_status, employee_id, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'pamo@reserveitlucena.onmicrosoft.com',
  'PAMO Officer',
  'internal',
  'pending',
  'PAMO-0001',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id, is_active, assigned_at)
SELECT u.id, r.id, TRUE, NOW()
FROM public.users u, public.roles r
WHERE u.email = 'pamo@reserveitlucena.onmicrosoft.com'
  AND r.name = 'pamo_officer'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = u.id AND ur.role_id = r.id
  );
